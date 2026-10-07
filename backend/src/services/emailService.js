const nodemailer = require('nodemailer');

/**
 * Email template. {{month}} is the month being billed (the month before today, since invoices go out
 * around the 1st for the previous month). Other variables: {{clientName}}, {{invoiceNumber}}, {{total}}, {{hours}}.
 */
const EMAIL_SUBJECT_TEMPLATE = 'Invoice for {{month}} – {{clientName}}';
const EMAIL_BODY_TEMPLATE = `Hello,

Please find attached invoice #{{invoiceNumber}} for work completed in {{month}}.

Total due: \${{total}} ({{hours}} hours)

Please let me know if you have any questions.

Thank you,
Wayne Bohannon
Bohannon Industries`;

/**
 * The month being billed: the calendar month before `now`, e.g. "September 2026".
 */
function billingMonthLabel(now = new Date()) {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return prev.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function fillTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

function invoiceFilename(invoice) {
  const clientName = (invoice.client && invoice.client.name) || 'Client';
  return `invoice-${invoice.id.slice(-8).toUpperCase()}-${clientName.replace(/\s+/g, '-')}.pdf`;
}

/**
 * Subject and body for an invoice email, filled from the templates above.
 */
function buildInvoiceEmailContent(invoice, now = new Date()) {
  const vars = {
    month: billingMonthLabel(now),
    clientName: (invoice.client && invoice.client.name) || 'Client',
    invoiceNumber: invoice.id.slice(-8).toUpperCase(),
    total: Number(invoice.totalAmount).toFixed(2),
    hours: invoice.totalHours,
  };
  return { subject: fillTemplate(EMAIL_SUBJECT_TEMPLATE, vars), text: fillTemplate(EMAIL_BODY_TEMPLATE, vars) };
}

function getFromEmail() {
  const from = process.env.INVOICE_FROM_EMAIL || process.env.SMTP_FROM;
  if (!from) throw new Error('INVOICE_FROM_EMAIL or SMTP_FROM must be set to send invoices');
  return from;
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error('SMTP_HOST, SMTP_USER, and SMTP_PASS must be set to send invoices');
  }
  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure,
    auth: { user, pass },
  });
}

/**
 * Send invoice PDF by email to the given addresses.
 * @param {Object} invoice - Invoice with client and lineItems
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string[]} toEmails - Recipient email addresses
 */
async function sendInvoiceEmail(invoice, pdfBuffer, toEmails) {
  if (!toEmails || toEmails.length === 0) {
    throw new Error('At least one recipient email is required');
  }
  const from = getFromEmail();
  const transporter = getTransporter();
  const { subject, text } = buildInvoiceEmailContent(invoice);
  await transporter.sendMail({
    from,
    to: toEmails.join(', '),
    subject,
    text,
    attachments: [{ filename: invoiceFilename(invoice), content: pdfBuffer, contentType: 'application/pdf' }],
  });
}

/**
 * Parse a string of emails (comma- or newline-separated) into an array of trimmed addresses.
 */
function parseBillingEmails(billingEmailStr) {
  if (!billingEmailStr || typeof billingEmailStr !== 'string') return [];
  return billingEmailStr
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e && e.includes('@'));
}

module.exports = {
  sendInvoiceEmail,
  buildInvoiceEmailContent,
  invoiceFilename,
  parseBillingEmails,
  getFromEmail,
};
