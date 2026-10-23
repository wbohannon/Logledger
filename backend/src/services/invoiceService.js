const { PrismaClient } = require('@prisma/client');
const { AppError, NotFoundError, ConflictError } = require('../utils/errors');
const clientService = require('./clientService');
const jiraService = require('./jiraService');
const { generateInvoicePdf } = require('./pdfService');
const emailService = require('./emailService');

const prisma = new PrismaClient();

async function findAll(filters = {}) {
  const where = {};
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.status) where.status = filters.status;
  return prisma.invoice.findMany({
    where,
    include: { client: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function findById(id) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { client: true, lineItems: true },
  });
  if (!invoice) throw new NotFoundError('Invoice');
  return invoice;
}

/**
 * Check if an invoice already exists for this client and date range (prevent duplicates).
 */
async function existsForClientAndDateRange(clientId, startDate, endDate, excludeInvoiceId = null) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const existing = await prisma.invoice.findFirst({
    where: {
      clientId,
      ...(excludeInvoiceId && { id: { not: excludeInvoiceId } }),
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });
  return !!existing;
}

/**
 * Derive start/end dates from issues' worklogs (min and max started).
 */
function getWorklogDateRange(issues) {
  let minTs = Infinity;
  let maxTs = -Infinity;
  for (const issue of issues) {
    for (const w of issue.worklogs || []) {
      if (w.started) {
        const ts = new Date(w.started).getTime();
        if (ts < minTs) minTs = ts;
        if (ts > maxTs) maxTs = ts;
      }
    }
  }
  if (minTs === Infinity) minTs = Date.now();
  if (maxTs === -Infinity) maxTs = Date.now();
  return { startDate: new Date(minTs), endDate: new Date(maxTs) };
}

/**
 * Preview: fetch Jira data (all issues matching JQL for project) and compute line items. No Jira updates.
 */
async function previewInvoice(clientId) {
  const client = await clientService.findById(clientId);
  const projectKey = client.jiraProjectKey;
  if (!projectKey) {
    throw new Error('Client has no Jira project key set');
  }
  const issues = await jiraService.fetchIssuesWithWorklogs(projectKey);
  const lineItems = jiraService.aggregateWorklogsForInvoice(issues, client.hourlyRate);
  const totalHours = lineItems.reduce((s, i) => s + i.hours, 0);
  const totalAmount = Math.round(totalHours * client.hourlyRate * 100) / 100;
  const { startDate, endDate } = getWorklogDateRange(issues);
  return {
    client,
    startDate,
    endDate,
    lineItems,
    totalHours,
    totalAmount,
    monthlyGoal: await getMonthlyGoalProgress(client, totalAmount),
  };
}

/**
 * Progress toward the client's monthly goal: invoices already generated this calendar month
 * plus the previewed amount, and the billable hours (at the client's rate) still needed to hit the goal.
 */
async function getMonthlyGoalProgress(client, previewAmount) {
  if (!client.monthlyGoal) return null;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const { _sum } = await prisma.invoice.aggregate({
    where: { clientId: client.id, createdAt: { gte: monthStart, lt: nextMonthStart } },
    _sum: { totalAmount: true },
  });
  const invoicedThisMonth = _sum.totalAmount ?? 0;
  const projectedAmount = Math.round((invoicedThisMonth + previewAmount) * 100) / 100;
  const remainingAmount = Math.max(0, Math.round((client.monthlyGoal - projectedAmount) * 100) / 100);
  const remainingHours = client.hourlyRate > 0
    ? Math.round((remainingAmount / client.hourlyRate) * 100) / 100
    : null;
  return {
    goal: client.monthlyGoal,
    invoicedThisMonth,
    previewAmount,
    projectedAmount,
    remainingAmount,
    remainingHours,
  };
}

/**
 * Generate and persist invoice from all unexported Jira issues for the client's project, then mark issues as exported.
 */
async function generateInvoice(clientId) {
  const client = await clientService.findById(clientId);
  const projectKey = client.jiraProjectKey;
  if (!projectKey) throw new Error('Client has no Jira project key set');

  const issues = await jiraService.fetchIssuesWithWorklogs(projectKey);
  const lineItemsData = jiraService.aggregateWorklogsForInvoice(issues, client.hourlyRate);
  if (lineItemsData.length === 0) {
    throw new Error('No issues with worklogs found for this project. Nothing to invoice.');
  }

  const totalHours = lineItemsData.reduce((s, i) => s + i.hours, 0);
  const totalAmount = Math.round(totalHours * client.hourlyRate * 100) / 100;
  const { startDate, endDate } = getWorklogDateRange(issues);

  const invoice = await prisma.invoice.create({
    data: {
      clientId,
      startDate,
      endDate,
      totalHours,
      totalAmount,
      status: 'draft',
      lineItems: {
        create: lineItemsData.map((item) => ({
          epicTitle: item.epicTitle ?? 'General Maintenance',
          issueKey: item.issueKey,
          summary: item.summary,
          worklogDescription: item.worklogDescription,
          hours: item.hours,
          rate: item.rate,
          amount: item.amount,
        })),
      },
    },
    include: { client: true, lineItems: true },
  });

  const jiraExportFailures = await markIssuesExported(issues.map((issue) => issue.key));

  return { ...invoice, jiraExportFailures };
}

/**
 * Set "time exported" = Yes on each Jira issue. Returns the keys that failed to update.
 */
async function markIssuesExported(issueKeys) {
  return updateIssues(issueKeys, jiraService.markIssueExported);
}

/**
 * Set "time exported" = No on each Jira issue. Returns the keys that failed to update.
 */
async function markIssuesNotExported(issueKeys) {
  return updateIssues(issueKeys, jiraService.markIssueNotExported);
}

async function updateIssues(issueKeys, update) {
  const failures = [];
  for (const issueKey of issueKeys) {
    try {
      await update(issueKey);
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      console.error(`Failed to update Jira issue ${issueKey}:`, detail);
      failures.push(issueKey);
    }
  }
  return failures;
}

/**
 * Mark Jira issues for this invoice as exported.
 * Uses invoice line items to determine issue keys.
 */
async function markInvoiceIssuesExported(invoice) {
  return markIssuesExported(getInvoiceIssueKeys(invoice));
}

function getInvoiceIssueKeys(invoice) {
  return Array.from(
    new Set((invoice.lineItems || []).map((item) => item.issueKey).filter(Boolean))
  );
}

/**
 * Delete a draft invoice and set its Jira issues back to "time exported" = No so they can be invoiced again.
 * If any Jira issue fails to reset, the invoice is kept so the delete can be retried.
 */
async function deleteDraft(id) {
  const invoice = await findById(id);
  if (invoice.status !== 'draft') {
    throw new ConflictError('Only draft invoices can be deleted');
  }
  const failures = await markIssuesNotExported(getInvoiceIssueKeys(invoice));
  if (failures.length > 0) {
    throw new AppError(
      `Could not reset "Time Exported" on Jira issues: ${failures.join(', ')}. The invoice was not deleted; try again.`,
      502
    );
  }
  await prisma.invoice.delete({ where: { id } });
}

async function getPdfBuffer(invoiceId) {
  const invoice = await findById(invoiceId);
  await markInvoiceIssuesExported(invoice);
  return generateInvoicePdf(invoice);
}

/**
 * Send invoice PDF by email to the client's billing email(s).
 * Client.billingEmail can be comma- or newline-separated (e.g. finance@client.com, client@client.com).
 */
async function sendInvoiceEmail(invoiceId) {
  const invoice = await findById(invoiceId);
  const emails = emailService.parseBillingEmails(invoice.client?.billingEmail);
  if (emails.length === 0) {
    throw new Error('This client has no billing emails set. Add one or more in Clients.');
  }
  const pdfBuffer = await getPdfBuffer(invoiceId);
  await emailService.sendInvoiceEmail(invoice, pdfBuffer, emails);
  return { sent: true, to: emails };
}

/**
 * Recipients, subject, and body for emailing an invoice from the user's own mail app.
 */
async function getEmailContent(invoiceId) {
  const invoice = await findById(invoiceId);
  const to = emailService.parseBillingEmails(invoice.client?.billingEmail);
  if (to.length === 0) {
    throw new Error('This client has no billing emails set. Add one or more in Clients.');
  }
  const { subject, text } = emailService.buildInvoiceEmailContent(invoice);
  return { to, subject, body: text };
}

async function updateStatus(id, status) {
  const allowed = ['draft', 'sent', 'paid'];
  if (!allowed.includes(status)) throw new Error('Invalid status');
  await findById(id);
  return prisma.invoice.update({
    where: { id },
    data: { status },
    include: { client: true, lineItems: true },
  });
}

module.exports = {
  findAll,
  findById,
  previewInvoice,
  generateInvoice,
  getPdfBuffer,
  updateStatus,
  deleteDraft,
  sendInvoiceEmail,
  getEmailContent,
  existsForClientAndDateRange,
};
