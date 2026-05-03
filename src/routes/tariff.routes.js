const express = require('express');
const router = express.Router();
const { saveTariff, getTariff, calculateRate } = require('../controllers/tariff.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/calculate', calculateRate);
router.get('/:customer_id', getTariff);

// Only admin can save tariffs
router.post('/:customer_id', authorize('admin'), saveTariff);

module.exports = router;
