const express = require('express');
const router = express.Router();
const { getCODCollections, getFinancialSummary } = require('../controllers/finance.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);
router.use(authorize('admin'));

router.get('/cod-collections', getCODCollections);
router.get('/summary', getFinancialSummary);

module.exports = router;
