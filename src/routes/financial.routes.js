const express = require('express');
const router = express.Router();
const { 
  submitHOTransfer, 
  verifyHOPayment, 
  generateCustomerInvoice, 
  processPayout,
  getCODCollections,
  getFinancialSummary,
  getMyInvoices,
  getUninvoicedShipments,
  markInvoiceAsPaid,
  getAllInvoices
} = require('../controllers/financial.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const uploadReceipt = require('../middleware/receipt.middleware');

router.use(protect);

router.get('/invoices', authorize('admin'), getAllInvoices);
router.patch('/invoices/:id/pay', authorize('admin'), uploadReceipt.single('receipt'), markInvoiceAsPaid);
router.get('/uninvoiced', authorize('admin'), getUninvoicedShipments);
router.get('/my-invoices', authorize('customer'), getMyInvoices);
router.get('/cod-collections', authorize('admin'), getCODCollections);
router.get('/summary', authorize('admin'), getFinancialSummary);
router.post('/ho-transfer', authorize('admin', 'ops'), submitHOTransfer);
router.patch('/ho-verify/:id', authorize('admin'), verifyHOPayment);
router.post('/invoices', authorize('admin'), generateCustomerInvoice);
router.post('/payouts', authorize('admin'), processPayout);

module.exports = router;
