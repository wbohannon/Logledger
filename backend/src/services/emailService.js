const nodemailer = require('nodemailer');

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
  const clientName = (invoice.client && invoice.client.name) || 'Client';
  const invoiceRef = invoice.id.slice(-8).toUpperCase();
  const subject = `Invoice #${invoiceRef} – ${clientName}`;
  const filename = `invoice-${invoiceRef}-${clientName.replace(/\s+/g, '-')}.pdf`;
  await transporter.sendMail({
    from,
    to: toEmails.join(', '),
    subject,
    text: `Please find attached invoice #${invoiceRef} for ${clientName}.\n\nTotal: $${Number(invoice.totalAmount).toFixed(2)} (${invoice.totalHours} hours).`,
    attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }],
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

module.exports = { sendInvoiceEmail, parseBillingEmails, getFromEmail };
