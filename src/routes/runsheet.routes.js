const express = require('express');
const router = express.Router();
const { createRunSheet, submitDeliveryReport, getRunSheets, getRunSheetDetails } = require('../controllers/runsheet.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);

router.post('/', authorize('admin', 'ops'), createRunSheet);
router.post('/submit', authorize('admin', 'ops'), submitDeliveryReport);
router.get('/', authorize('admin', 'ops'), getRunSheets);
router.get('/:id', authorize('admin', 'ops'), getRunSheetDetails);

module.exports = router;
