const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe, updateProfile, getStudentProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.get('/student/:identifier', protect, getStudentProfile);

module.exports = router;

