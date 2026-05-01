const express = require('express');
const router = express.Router();
const { getAllUsers, createUser, updateUser, deleteUser, getRidersByBranch } = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.get('/', protect, authorize('admin'), getAllUsers);
router.post('/', protect, authorize('admin'), createUser);
router.patch('/:id', protect, authorize('admin'), updateUser);
router.delete('/:id', protect, authorize('admin'), deleteUser);
router.get('/riders/:branch_id', protect, getRidersByBranch);

module.exports = router;
