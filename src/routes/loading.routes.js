const express = require('express');
const router = express.Router();
const { createLoadingSheet, getLoadingSheets, updateLoadingSheetStatus, getLoadingSheetById } = require('../controllers/loading.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);
router.use(authorize('admin', 'ops'));

router.post('/', createLoadingSheet);
router.get('/', getLoadingSheets);
router.get('/:id', getLoadingSheetById);
router.patch('/:id/status', updateLoadingSheetStatus);

module.exports = router;
