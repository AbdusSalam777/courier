const express = require('express');
const router = express.Router();
const { getAllBranches, createBranch, updateBranch, deleteBranch, assignUserToBranch } = require('../controllers/branch.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.get('/', protect, getAllBranches);
router.post('/', protect, authorize('admin'), createBranch);
router.patch('/:id', protect, authorize('admin'), updateBranch);
router.delete('/:id', protect, authorize('admin'), deleteBranch);
router.post('/assign', protect, authorize('admin'), assignUserToBranch);

module.exports = router;
