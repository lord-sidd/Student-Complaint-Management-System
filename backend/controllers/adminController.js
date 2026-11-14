const User = require('../models/User');
const Department = require('../models/Department');
const Complaint = require('../models/Complaint');
const AuditLog = require('../models/AuditLog');
const storageService = require('../services/storageService');

// @desc    Get all users (with search, filter, pagination)
// @route   GET /api/admin/users
const getUsers = async (req, res) => {
  try {
    const { role, department, search, page = 1, limit = 20 } = req.query;

    if (storageService.isMongoOnline()) {
      let query = {};

      if (role && role !== 'ALL') {
        query.role = role;
      }
      if (department && department !== 'ALL') {
        query.department = department;
      }
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { rollNo: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await User.countDocuments(query);
      const users = await User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      return res.json({
        success: true,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)) || 1,
        data: users,
      });
    }

    const allUsers = storageService.getUsers({ role, department, search });
    const safeUsers = allUsers.map(u => {
      const { password, ...safe } = u;
      return safe;
    });

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginated = safeUsers.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      total: safeUsers.length,
      page: parseInt(page),
      pages: Math.ceil(safeUsers.length / parseInt(limit)) || 1,
      data: paginated,
    });
  } catch (error) {
    console.error('Error in getUsers:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new user by admin
// @route   POST /api/admin/users
const createUser = async (req, res) => {
  try {
    const { name, email, rollNo, department, role, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (storageService.isMongoOnline()) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(400).json({ message: 'User already exists with this email' });
      }

      const user = await User.create({
        name,
        email: email.toLowerCase(),
        rollNo: rollNo || '',
        department: department || 'IT',
        role: role || 'student',
        password,
        phone: phone || '',
      });

      await AuditLog.create({
        action: 'USER_CREATED',
        performedBy: req.user?.name || 'Administrator',
        role: req.user?.role || 'admin',
        details: `Created new user ${user.name} (${user.email}) with role ${user.role}`,
      }).catch(() => {});

      return res.status(201).json({
        success: true,
        message: `User ${user.name} created successfully`,
        data: {
          _id: user._id,
          id: user.customId || user._id,
          name: user.name,
          email: user.email,
          rollNo: user.rollNo,
          department: user.department,
          role: user.role,
          isActive: user.isActive,
        },
      });
    }

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
      phone: phone || '',
    });

    storageService.logAudit('USER_CREATED', req.user?.name || 'Administrator', 'admin', `Created user ${newUser.name}`);

    const { password: _, ...safeUser } = newUser;
    res.status(201).json({
      success: true,
      message: `User ${newUser.name} created successfully`,
      data: safeUser,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user
// @route   PUT /api/admin/users/:id
const updateUser = async (req, res) => {
  try {
    const { name, department, role, isActive, phone } = req.body;

    if (storageService.isMongoOnline()) {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (name) user.name = name;
      if (department) user.department = department;
      if (role) user.role = role;
      if (typeof isActive === 'boolean') user.isActive = isActive;
      if (phone !== undefined) user.phone = phone;

      await user.save();

      return res.json({
        success: true,
        message: 'User updated successfully',
        data: {
          _id: user._id,
          id: user.customId || user._id,
          name: user.name,
          email: user.email,
          rollNo: user.rollNo,
          department: user.department,
          role: user.role,
          isActive: user.isActive,
        },
      });
    }

    const updated = storageService.updateUser(req.params.id, { name, department, role, isActive, phone });
    if (!updated) return res.status(404).json({ message: 'User not found' });

    const { password: _, ...safe } = updated;
    res.json({
      success: true,
      message: 'User updated successfully',
      data: safe,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete / deactivate user
// @route   DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
  try {
    if (storageService.isMongoOnline()) {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      await User.findByIdAndDelete(req.params.id);

      await AuditLog.create({
        action: 'USER_DELETED',
        performedBy: req.user?.name || 'Administrator',
        role: req.user?.role || 'admin',
        details: `Deleted user ${user.name} (${user.email})`,
      }).catch(() => {});

      return res.json({ success: true, message: 'User deleted successfully' });
    }

    const deleted = storageService.deleteUser(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'User not found' });

    storageService.logAudit('USER_DELETED', req.user?.name || 'Administrator', 'admin', `Deleted user ID ${req.params.id}`);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all departments with health stats
// @route   GET /api/admin/departments
const getDepartments = async (req, res) => {
  try {
    if (storageService.isMongoOnline()) {
      let departments = await Department.find();

      if (!departments || departments.length === 0) {
        departments = [
          { code: 'IT', name: 'Information Technology', headOfficer: 'Prof. Kulkarni', email: 'ithod@zeal.edu.in', slaTargetHours: 48 },
          { code: 'COMP', name: 'Computer Engineering', headOfficer: 'Prof. Sharma', email: 'comphod@zeal.edu.in', slaTargetHours: 48 },
          { code: 'INFRA', name: 'Infrastructure & Estate Maintenance', headOfficer: 'Estate Manager', email: 'infra@zeal.edu.in', slaTargetHours: 72 },
          { code: 'TRANS', name: 'Transportation Authority', headOfficer: 'Transport Head', email: 'transport@zeal.edu.in', slaTargetHours: 48 },
          { code: 'EXAM', name: 'Examination & Evaluation Cell', headOfficer: 'Controller of Exams', email: 'exam@zeal.edu.in', slaTargetHours: 72 },
          { code: 'HOSTEL', name: 'Hostel Amenities & Living', headOfficer: 'Hostel Chief Rector', email: 'hostel@zeal.edu.in', slaTargetHours: 48 },
        ];
      }

      const enriched = await Promise.all(
        departments.map(async (dept) => {
          const total = await Complaint.countDocuments({ department: dept.code });
          const pending = await Complaint.countDocuments({ department: dept.code, status: 'Pending' });
          const inProgress = await Complaint.countDocuments({ department: dept.code, status: 'In Progress' });
          const resolved = await Complaint.countDocuments({ department: dept.code, status: { $in: ['Resolved', 'Closed'] } });
          const overdue = await Complaint.countDocuments({ department: dept.code, isOverdue: true });

          const complianceRate = total > 0 ? Math.round(((total - overdue) / total) * 100) : 100;

          return {
            code: dept.code,
            name: dept.name,
            headOfficer: dept.headOfficer,
            email: dept.email,
            slaTargetHours: dept.slaTargetHours || 72,
            metrics: {
              total,
              pending,
              inProgress,
              resolved,
              overdue,
              complianceRate,
            },
          };
        })
      );

      return res.json({ success: true, count: enriched.length, data: enriched });
    }

    const depts = storageService.getDepartments();
    const enriched = depts.map(d => ({
      code: d.code,
      name: d.name,
      headOfficer: d.headOfficer,
      email: d.email,
      slaTargetHours: d.slaTargetHours || 72,
      metrics: {
        total: d.totalComplaints,
        pending: d.pendingComplaints,
        inProgress: d.inProgressComplaints,
        resolved: d.resolvedComplaints,
        overdue: d.overdueComplaints,
        complianceRate: d.complianceRate,
      }
    }));

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get audit logs
// @route   GET /api/admin/audit-logs
const getAuditLogs = async (req, res) => {
  try {
    if (storageService.isMongoOnline()) {
      const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(50);
      return res.json({ success: true, count: logs.length, data: logs });
    }
    const logs = storageService.getAuditLogs(50);
    res.json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getDepartments,
  getAuditLogs,
};
