const PDFDocument = require('pdfkit');

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

/**
 * Generate invoice PDF buffer.
 * @param {Object} invoice - Invoice with client and lineItems
 * @returns {Promise<Buffer>}
 */
function generateInvoicePdf(invoice) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const client = invoice.client;
    const lineItems = invoice.lineItems || [];

    doc.fontSize(22).text('INVOICE', { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Invoice #${invoice.id.slice(-8).toUpperCase()}`, { align: 'right' });
    doc.text(`Status: ${invoice.status.toUpperCase()}`, { align: 'right' });
    doc.moveDown(1);

    doc.text('Bill To:', 50, doc.y);
    doc.font('Helvetica-Bold').text(client.name, 50, doc.y + 4);
    doc.font('Helvetica');
    if (client.billingEmail) doc.text(client.billingEmail, 50, doc.y + 4);
    doc.moveDown(1);

    doc.text(`Period: ${formatDate(invoice.startDate)} – ${formatDate(invoice.endDate)}`, 50, doc.y);
    doc.moveDown(1.5);

    const tableTop = doc.y + 10;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Epic', 50, tableTop, { width: 55 });
    doc.text('Issue', 108, tableTop, { width: 52 });
    doc.text('Summary', 162, tableTop, { width: 95 });
    doc.text('Work description', 258, tableTop, { width: 115 });
    doc.text('Hours', 375, tableTop, { width: 38, align: 'right' });
    doc.text('Rate', 415, tableTop, { width: 48, align: 'right' });
    doc.text('Amount', 465, tableTop, { width: 55, align: 'right' });
    doc.font('Helvetica').fontSize(8);

    let y = tableTop + 20;
    for (const item of lineItems) {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      doc.text((item.epicTitle || 'General Maintenance').slice(0, 18), 50, y, { width: 55 });
      doc.text(item.issueKey || '-', 108, y, { width: 52 });
      doc.text((item.summary || '-').slice(0, 22), 162, y, { width: 95 });
      doc.text((item.worklogDescription || '-').slice(0, 28), 258, y, { width: 115 });
      doc.text(String(item.hours), 375, y, { width: 38, align: 'right' });
      doc.text(formatCurrency(item.rate), 415, y, { width: 48, align: 'right' });
      doc.text(formatCurrency(item.amount), 465, y, { width: 55, align: 'right' });
      y += 20;
    }

    y += 10;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Total Hours:', 375, y);
    doc.text(String(invoice.totalHours), 415, y, { width: 48, align: 'right' });
    y += 18;
    doc.text('Total Amount:', 375, y);
    doc.text(formatCurrency(invoice.totalAmount), 465, y, { width: 55, align: 'right' });
    doc.font('Helvetica');

    doc.moveDown(3);
    doc.fontSize(9).fillColor('gray').text('Thank you for your business.', 50, doc.y);

    doc.end();
  });
}

module.exports = { generateInvoicePdf };
