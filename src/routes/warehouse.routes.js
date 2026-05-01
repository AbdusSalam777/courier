const express = require('express');
const router = express.Router();
const { receiveShipment, getWarehouseShipments } = require('../controllers/warehouse.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);
router.use(authorize('admin', 'ops'));

router.post('/receive', receiveShipment);
router.get('/shipments/:branchId', getWarehouseShipments);

module.exports = router;
