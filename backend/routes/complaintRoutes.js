const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { optionalProtect, protect, authorize } = require('../middleware/authMiddleware');
const {
  getComplaints,
  getComplaintById,
  createComplaint,
  updateComplaint,
  assignComplaint,
  submitFeedback,
  aiSuggest,
  uploadAttachment,
  exportComplaintsCSV,
  getStats,
} = require('../controllers/complaintController');

// Analytics & Export
router.get('/analytics/stats', getStats);
router.get('/export/csv', exportComplaintsCSV);

// AI Assistance
router.post('/ai-suggest', aiSuggest);

// File Attachment Upload (supports both 'file' and 'attachment' fields)
router.post('/upload', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'attachment', maxCount: 1 }]), uploadAttachment);

// Complaints CRUD with optional/enforced role checking
router.get('/', optionalProtect, getComplaints);
router.get('/:id', optionalProtect, getComplaintById);
router.post('/', optionalProtect, createComplaint);
router.put('/:id', optionalProtect, updateComplaint);

// Assignment & Feedback
router.put('/:id/assign', optionalProtect, assignComplaint);
router.post('/:id/feedback', optionalProtect, submitFeedback);

module.exports = router;
