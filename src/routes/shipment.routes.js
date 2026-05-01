const express = require('express');
const router = express.Router();
const { 
  createShipment, 
  getAllShipments, 
  getShipmentByTrackingId, 
  updateShipmentStatus,
  bulkUploadShipments,
  generateLabelFile,
  updateServiceCharge
} = require('../controllers/shipment.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.post('/', protect, createShipment);
router.post('/bulk', protect, upload.single('file'), bulkUploadShipments);
router.get('/', protect, getAllShipments);
router.get('/tracking/:trackingId', getShipmentByTrackingId);
router.patch('/:id/status', protect, authorize('admin', 'ops'), updateShipmentStatus);
router.patch('/:id/service-charge', protect, authorize('admin', 'ops'), updateServiceCharge);
router.post('/:id/label', protect, authorize('admin', 'ops', 'customer'), generateLabelFile);

module.exports = router;
