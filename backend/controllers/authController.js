const jwt = require('jsonwebtoken');
const User = require('../models/User');
const storageService = require('../services/storageService');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'scms_super_secret_jwt_key_2026', {
    expiresIn: '7d',
  });
};

// @desc    Register a new student/user
// @route   POST /api/auth/register
const registerUser = async (req, res) => {
  try {
    const { name, email, rollNo, department, password, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Please provide name, email and password' });
    }

    if (storageService.isMongoOnline()) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists with this email' });
      }

      const user = await User.create({
        name,
        email: email.toLowerCase(),
        rollNo: rollNo || '',
        department: department || 'IT',
        role: role || 'student',
        password,
      });

      return res.status(201).json({
        success: true,
        user: {
          id: user.customId || user._id,
          _id: user._id,
          name: user.name,
          email: user.email,
          rollNo: user.rollNo,
          department: user.department,
          role: user.role,
        },
        token: generateToken(user._id),
      });
    }

    // Local Storage Fallback
    const existing = storageService.findUser(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const newUser = storageService.createUser({
      name,
      email: email.toLowerCase(),
      rollNo: rollNo || '',
      department: department || 'IT',
      role: role || 'student',
      password,
    });

    res.status(201).json({
      success: true,
      user: {
        id: newUser.customId || newUser._id,
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        rollNo: newUser.rollNo,
        department: newUser.department,
        role: newUser.role,
      },
      token: generateToken(newUser._id),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const { identifier, password, role, department } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Please provide email/rollNo and password' });
    }

    const cleanId = identifier.trim().toLowerCase();

    if (storageService.isMongoOnline()) {
      let user = await User.findOne({
        $or: [
          { email: cleanId },
          { rollNo: { $regex: new RegExp(`^${cleanId}$`, 'i') } }
        ]
      });

      if (!user) {
        const nameStr = role === 'student' ? (cleanId.includes('@') ? cleanId.split('@')[0] : cleanId) :
                        role === 'authority' ? `Prof. Officer (${department || 'IT'})` : 'System Administrator';

        user = await User.create({
          name: nameStr.charAt(0).toUpperCase() + nameStr.slice(1),
          email: cleanId.includes('@') ? cleanId : `${cleanId}@zeal.edu.in`,
          rollNo: role === 'student' ? (cleanId.includes('@') ? 'IT2143' : cleanId.toUpperCase()) : 'STAFF-AUTH',
          department: department || 'IT',
          role: role || 'student',
          password: password,
        });
      } else {
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }
      }

      return res.json({
        success: true,
        user: {
          id: user.customId || user._id,
          _id: user._id,
          name: user.name,
          email: user.email,
          rollNo: user.rollNo,
          department: user.department,
          role: user.role,
        },
        token: generateToken(user._id),
      });
    }

    // Local Storage Fallback
    let localUser = storageService.findUser(u =>
      (u.email.toLowerCase() === cleanId || (u.rollNo && u.rollNo.toLowerCase() === cleanId))
    );

    if (!localUser) {
      const nameStr = role === 'student' ? (cleanId.includes('@') ? cleanId.split('@')[0] : cleanId) :
                      role === 'authority' ? `Prof. Officer (${department || 'IT'})` : 'System Administrator';

      localUser = storageService.createUser({
        name: nameStr.charAt(0).toUpperCase() + nameStr.slice(1),
        email: cleanId.includes('@') ? cleanId : `${cleanId}@zeal.edu.in`,
        rollNo: role === 'student' ? (cleanId.includes('@') ? 'IT2143' : cleanId.toUpperCase()) : 'STAFF-AUTH',
        department: department || 'IT',
        role: role || 'student',
        password: password,
      });
    } else {
      if (localUser.password !== password) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    }

    res.json({
      success: true,
      user: {
        id: localUser.customId || localUser._id,
        _id: localUser._id,
        name: localUser.name,
        email: localUser.email,
        rollNo: localUser.rollNo,
        department: localUser.department,
        role: localUser.role,
      },
      token: generateToken(localUser._id),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  try {
    if (storageService.isMongoOnline()) {
      const user = await User.findById(req.user._id).select('-password');
      return res.json({ success: true, user });
    }
    const user = storageService.findUser(u => u._id === req.user?._id || u.customId === req.user?.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { password, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { registerUser, loginUser, getMe };
