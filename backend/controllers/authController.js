const jwt = require('jsonwebtoken');
const User = require('../models/User');
const storageService = require('../services/storageService');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'scms_super_secret_jwt_key_2026', {
    expiresIn: '7d',
  });
};

const formatUserResponse = (user) => {
  const u = user.toObject ? user.toObject() : user;
  return {
    id: u.customId || u._id,
    _id: u._id,
    name: u.name,
    email: u.email,
    rollNo: u.rollNo || '',
    department: u.department || 'IT',
    role: u.role || 'student',
    phone: u.phone || '',
    academicYear: u.academicYear || 'TE (Third Year)',
    division: u.division || 'A',
    guardianName: u.guardianName || '',
    guardianPhone: u.guardianPhone || '',
    address: u.address || '',
    batchYear: u.batchYear || '2023 - 2027',
    avatar: u.avatar || '',
    createdAt: u.createdAt,
  };
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
        user: formatUserResponse(user),
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
      user: formatUserResponse(newUser),
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
      return res.status(400).json({ message: 'Please provide email/roll number and password' });
    }

    const cleanId = identifier.trim().toLowerCase();

    if (storageService.isMongoOnline()) {
      // Find all candidates matching email or rollNo (case-insensitive)
      const candidates = await User.find({
        $or: [
          { email: cleanId },
          { rollNo: { $regex: new RegExp(`^${cleanId}$`, 'i') } }
        ]
      });

      if (!candidates || candidates.length === 0) {
        return res.status(401).json({ message: 'Account not found. Please verify your email/roll number or register.' });
      }

      // Check candidates for valid password match
      let matchedUser = null;
      let wrongRoleUser = null;

      for (const candidate of candidates) {
        const isMatch = await candidate.comparePassword(password);
        if (isMatch) {
          if (role && candidate.role !== role) {
            wrongRoleUser = candidate;
          } else {
            matchedUser = candidate;
            break;
          }
        }
      }

      // If password matched but under the wrong role tab
      if (!matchedUser && wrongRoleUser) {
        const tabLabels = { student: 'Student Login', authority: 'Dept Officer', admin: 'Admin' };
        return res.status(401).json({
          message: `This account is registered with role "${wrongRoleUser.role.toUpperCase()}". Please switch to the "${tabLabels[wrongRoleUser.role] || wrongRoleUser.role}" tab.`
        });
      }

      if (!matchedUser) {
        return res.status(401).json({ message: 'Invalid credentials. Password is incorrect.' });
      }

      // If authority, verify department if specified
      if (matchedUser.role === 'authority' && department && matchedUser.department !== department) {
        return res.status(401).json({
          message: `Access denied. Your officer account is assigned to ${matchedUser.department} department.`
        });
      }

      return res.json({
        success: true,
        user: formatUserResponse(matchedUser),
        token: generateToken(matchedUser._id),
      });
    }

    // Local Storage Fallback
    const allUsers = storageService.getUsers ? storageService.getUsers() : (storageService.readDb().users || []);
    const localCandidates = allUsers.filter(u =>
      (u.email && u.email.toLowerCase() === cleanId) ||
      (u.rollNo && u.rollNo.toLowerCase() === cleanId)
    );

    if (localCandidates.length === 0) {
      return res.status(401).json({ message: 'Account not found. Please verify your email or register.' });
    }

    let matchedLocal = null;
    let wrongRoleLocal = null;

    for (const u of localCandidates) {
      if (u.password === password) {
        if (role && u.role !== role) {
          wrongRoleLocal = u;
        } else {
          matchedLocal = u;
          break;
        }
      }
    }

    if (!matchedLocal && wrongRoleLocal) {
      return res.status(401).json({
        message: `This account is registered with role "${wrongRoleLocal.role.toUpperCase()}". Please switch to the appropriate tab.`
      });
    }

    if (!matchedLocal) {
      return res.status(401).json({ message: 'Invalid credentials. Password is incorrect.' });
    }

    res.json({
      success: true,
      user: formatUserResponse(matchedLocal),
      token: generateToken(matchedLocal._id),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message || 'Server error during login' });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  try {
    if (storageService.isMongoOnline()) {
      const user = await User.findById(req.user._id).select('-password');
      return res.json({ success: true, user: formatUserResponse(user) });
    }
    const user = storageService.findUser(u => u._id === req.user?._id || u.customId === req.user?.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ success: true, user: formatUserResponse(user) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update current user profile
// @route   PUT /api/auth/profile
const updateProfile = async (req, res) => {
  try {
    const { name, phone, department, rollNo, academicYear, division, guardianName, guardianPhone, address, batchYear, avatar } = req.body;

    if (storageService.isMongoOnline()) {
      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      if (name) user.name = name;
      if (phone !== undefined) user.phone = phone;
      if (department) user.department = department;
      if (rollNo) user.rollNo = rollNo;
      if (academicYear !== undefined) user.academicYear = academicYear;
      if (division !== undefined) user.division = division;
      if (guardianName !== undefined) user.guardianName = guardianName;
      if (guardianPhone !== undefined) user.guardianPhone = guardianPhone;
      if (address !== undefined) user.address = address;
      if (batchYear !== undefined) user.batchYear = batchYear;
      if (avatar !== undefined) user.avatar = avatar;

      await user.save();
      return res.json({ success: true, message: 'Profile updated successfully', user: formatUserResponse(user) });
    }

    const updated = storageService.updateUser(req.user._id || req.user.id || req.user.customId, {
      ...(name && { name }),
      ...(phone !== undefined && { phone }),
      ...(department && { department }),
      ...(rollNo && { rollNo }),
      ...(academicYear !== undefined && { academicYear }),
      ...(division !== undefined && { division }),
      ...(guardianName !== undefined && { guardianName }),
      ...(guardianPhone !== undefined && { guardianPhone }),
      ...(address !== undefined && { address }),
      ...(batchYear !== undefined && { batchYear }),
      ...(avatar !== undefined && { avatar }),
    });

    if (!updated) return res.status(404).json({ message: 'User not found' });
    res.json({ success: true, message: 'Profile updated successfully', user: formatUserResponse(updated) });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Get student profile with complaint history
// @route   GET /api/auth/student/:identifier
const getStudentProfile = async (req, res) => {
  try {
    const { identifier } = req.params;
    const cleanId = (identifier || '').trim().toLowerCase();

    let student = null;
    let complaints = [];

    if (storageService.isMongoOnline()) {
      const Complaint = require('../models/Complaint');
      student = await User.findOne({
        $or: [
          { customId: identifier },
          { email: cleanId },
          { rollNo: { $regex: new RegExp(`^${cleanId}$`, 'i') } }
        ]
      }).select('-password');

      if (!student) {
        return res.status(404).json({ message: 'Student profile not found' });
      }

      complaints = await Complaint.find({
        $or: [
          { studentEmail: student.email },
          { studentRollNo: student.rollNo },
          { userId: student.customId },
          { userId: student._id.toString() }
        ]
      }).sort({ createdAt: -1 });

    } else {
      student = storageService.findUser(u =>
        u.customId === identifier ||
        u.email.toLowerCase() === cleanId ||
        (u.rollNo && u.rollNo.toLowerCase() === cleanId)
      );

      if (!student) {
        return res.status(404).json({ message: 'Student profile not found' });
      }

      const allComplaints = storageService.getComplaints();
      complaints = allComplaints.filter(c =>
        (c.studentEmail && c.studentEmail.toLowerCase() === student.email.toLowerCase()) ||
        (c.studentRollNo && c.studentRollNo.toLowerCase() === (student.rollNo || '').toLowerCase()) ||
        c.userId === student.customId ||
        c.userId === student._id
      );
    }

    const formattedStudent = formatUserResponse(student);
    const stats = {
      total: complaints.length,
      pending: complaints.filter(c => c.status === 'Pending').length,
      inProgress: complaints.filter(c => c.status === 'In Progress').length,
      resolved: complaints.filter(c => c.status === 'Resolved' || c.status === 'Closed').length,
    };

    res.json({
      success: true,
      student: formattedStudent,
      stats,
      recentComplaints: complaints.slice(0, 15),
    });
  } catch (error) {
    console.error('Get student profile error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

module.exports = { registerUser, loginUser, getMe, updateProfile, getStudentProfile };
