const express = require('express');
const router = express.Router();
const { getAdminDashboard, getOpsDashboard, getCustomerDashboard } = require('../controllers/dashboard.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.get('/admin', protect, authorize('admin'), getAdminDashboard);
router.get('/ops', protect, authorize('admin', 'ops'), getOpsDashboard);
router.get('/customer', protect, authorize('customer'), getCustomerDashboard);

module.exports = router;
