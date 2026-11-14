const express = require('express');
const router = express.Router();
const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getDepartments,
  getAuditLogs,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Admin only routes
router.use(protect);
router.use(authorize('admin'));

router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

router.get('/departments', getDepartments);
router.get('/audit-logs', getAuditLogs);

module.exports = router;

