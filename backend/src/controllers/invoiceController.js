const invoiceService = require('../services/invoiceService');
const { asyncHandler } = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const { clientId, status } = req.query;
  const invoices = await invoiceService.findAll({ clientId, status });
  res.json(invoices);
});

const get = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.findById(req.params.id);
  res.json(invoice);
});

const preview = asyncHandler(async (req, res) => {
  const { clientId } = req.body;
  if (!clientId) {
    return res.status(400).json({ error: 'clientId is required' });
  }
  const previewData = await invoiceService.previewInvoice(clientId);
  res.json(previewData);
});

const generate = asyncHandler(async (req, res) => {
  const { clientId } = req.body;
  if (!clientId) {
    return res.status(400).json({ error: 'clientId is required' });
  }
  const invoice = await invoiceService.generateInvoice(clientId);
  res.status(201).json(invoice);
});

const downloadPdf = asyncHandler(async (req, res) => {
  const buffer = await invoiceService.getPdfBuffer(req.params.id);
  const invoice = await invoiceService.findById(req.params.id);
  const filename = `invoice-${invoice.id.slice(-8)}-${invoice.client.name.replace(/\s+/g, '-')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });
  const invoice = await invoiceService.updateStatus(req.params.id, status);
  res.json(invoice);
});

const sendEmail = asyncHandler(async (req, res) => {
  const result = await invoiceService.sendInvoiceEmail(req.params.id);
  res.json(result);
});

module.exports = { list, get, preview, generate, downloadPdf, updateStatus, sendEmail };
