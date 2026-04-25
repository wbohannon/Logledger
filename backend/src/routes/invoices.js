const express = require('express');
const invoiceController = require('../controllers/invoiceController');

const router = express.Router();
router.get('/', invoiceController.list);
router.get('/:id', invoiceController.get);
router.post('/preview', invoiceController.preview);
router.post('/generate', invoiceController.generate);
router.get('/:id/pdf', invoiceController.downloadPdf);
router.post('/:id/send', invoiceController.sendEmail);
router.patch('/:id/status', invoiceController.updateStatus);

module.exports = router;
