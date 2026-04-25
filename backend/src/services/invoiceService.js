const { PrismaClient } = require('@prisma/client');
const { NotFoundError } = require('../utils/errors');
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

  for (const issue of issues) {
    try {
      await jiraService.markIssueExported(issue.key);
    } catch (err) {
      console.error(`Failed to update Jira issue ${issue.key}:`, err.message);
    }
  }

  return invoice;
}

/**
 * Mark Jira issues for this invoice as exported.
 * Uses invoice line items to determine issue keys.
 */
async function markInvoiceIssuesExported(invoice) {
  const issueKeys = Array.from(
    new Set((invoice.lineItems || []).map((item) => item.issueKey).filter(Boolean))
  );
  for (const issueKey of issueKeys) {
    try {
      await jiraService.markIssueExported(issueKey);
    } catch (err) {
      console.error(`Failed to update Jira issue ${issueKey}:`, err.message);
    }
  }
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
  sendInvoiceEmail,
  existsForClientAndDateRange,
};
