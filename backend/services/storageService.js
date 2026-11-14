const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'local_db.json');

const INITIAL_USERS = [
  {
    _id: 'USR-101',
    customId: 'USR-101',
    name: 'Swaraj Godambe',
    email: 'swaraj@zeal.edu.in',
    rollNo: 'IT2143',
    department: 'IT',
    role: 'student',
    password: 'swaraj@123',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    _id: 'USR-102',
    customId: 'USR-102',
    name: 'Prof. Kulkarni',
    email: 'ithod@zeal.edu.in',
    rollNo: 'STAFF-IT',
    department: 'IT',
    role: 'authority',
    password: 'officer123',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    _id: 'USR-103',
    customId: 'USR-103',
    name: 'College Administration',
    email: 'admin@zeal.edu.in',
    rollNo: 'ADMIN-01',
    department: 'ALL',
    role: 'admin',
    password: 'admin123',
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

const INITIAL_DEPARTMENTS = [
  { code: 'IT', name: 'Information Technology', headOfficer: 'Prof. Kulkarni', email: 'ithod@zeal.edu.in', slaTargetHours: 48 },
  { code: 'COMP', name: 'Computer Engineering', headOfficer: 'Prof. Sharma', email: 'comphod@zeal.edu.in', slaTargetHours: 48 },
  { code: 'INFRA', name: 'Infrastructure & Estate Maintenance', headOfficer: 'Estate Manager', email: 'infra@zeal.edu.in', slaTargetHours: 72 },
  { code: 'TRANS', name: 'Transportation Authority', headOfficer: 'Transport Head', email: 'transport@zeal.edu.in', slaTargetHours: 48 },
  { code: 'EXAM', name: 'Examination & Evaluation Cell', headOfficer: 'Controller of Exams', email: 'exam@zeal.edu.in', slaTargetHours: 72 },
  { code: 'HOSTEL', name: 'Hostel Amenities & Living', headOfficer: 'Hostel Chief Rector', email: 'hostel@zeal.edu.in', slaTargetHours: 48 }
];

const INITIAL_COMPLAINTS = [
  {
    _id: '662e00010000000000000001',
    ticketId: 'CMP-2026-1042',
    id: 'CMP-2026-1042',
    title: 'PC #18 Monitor & RAM Failure in IT Lab 3',
    department: 'IT',
    category: 'Academics',
    priority: 'High',
    studentName: 'Siddhesh Dhavale (IT2143)',
    studentEmail: 'siddhesh@zeal.edu.in',
    studentRollNo: 'IT2143',
    userId: 'USR-101',
    description: 'During the DBMS practical session, PC #18 display kept flickering and randomly rebooted with blue screen error. Kindly replace RAM or display cable before next exam session.',
    attachment: 'error_screenshot_lab3.png',
    status: 'In Progress',
    slaDeadline: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    isOverdue: false,
    escalated: false,
    assignedTo: {
      name: 'Mr. Shinde',
      email: 'shinde@zeal.edu.in',
      role: 'Hardware Lab Technician',
      assignedAt: new Date(Date.now() - 3600 * 1000).toISOString()
    },
    createdAtStr: '2026-10-08 09:30 AM',
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    timeline: [
      { step: 'Complaint Submitted', date: '2026-10-08 09:30 AM', desc: 'Submitted by student via SCMS Portal.', author: 'Siddhesh Dhavale' },
      { step: 'Validated & Forwarded', date: '2026-10-08 11:15 AM', desc: 'Verified by Head of IT Dept (Prof. Kulkarni).', author: 'Prof. Kulkarni' },
      { step: 'In Investigation', date: '2026-10-08 02:45 PM', desc: 'Assigned to Lab Assistant for hardware check.', author: 'Prof. Kulkarni' }
    ],
    remarks: [
      { author: 'Prof. Kulkarni (HOD IT)', date: '2026-10-08 11:15 AM', text: 'Ticket verified. Forwarded to Lab Technician Mr. Shinde for immediate RAM check.' }
    ]
  },
  {
    _id: '662e00010000000000000002',
    ticketId: 'CMP-2026-1043',
    id: 'CMP-2026-1043',
    title: 'Wi-Fi Signal Drop in 3rd Floor IT Block',
    department: 'IT',
    category: 'Infrastructure',
    priority: 'Medium',
    studentName: 'Suraj Padwal (IT2123)',
    studentEmail: 'suraj@zeal.edu.in',
    studentRollNo: 'IT2123',
    userId: 'USR-201',
    description: 'The Wi-Fi access point near Classroom 304 keeps disconnecting every 5 minutes, preventing students from accessing online research portals.',
    attachment: null,
    status: 'Pending',
    slaDeadline: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    isOverdue: false,
    escalated: false,
    createdAtStr: '2026-10-09 10:15 AM',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    timeline: [
      { step: 'Complaint Submitted', date: '2026-10-09 10:15 AM', desc: 'Received in central complaint queue.', author: 'Suraj Padwal' }
    ],
    remarks: []
  },
  {
    _id: '662e00010000000000000003',
    ticketId: 'CMP-2026-1039',
    id: 'CMP-2026-1039',
    title: 'Route #4 College Bus Delay on Katraj Highway',
    department: 'TRANS',
    category: 'Transportation',
    priority: 'High',
    studentName: 'Swaraj Godambe (IT2132)',
    studentEmail: 'swaraj@zeal.edu.in',
    studentRollNo: 'IT2132',
    userId: 'USR-202',
    description: 'Route #4 bus arrived 35 minutes late due to unauthorized stop. Students missed the morning 8:30 AM attendance lecture.',
    attachment: 'bus_ticket_route4.pdf',
    status: 'Resolved',
    slaDeadline: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    isOverdue: false,
    escalated: false,
    feedback: {
      rating: 5,
      comment: 'Bus route has been properly aligned now. Thank you for resolving quickly!',
      submittedAt: new Date().toISOString(),
      studentName: 'Swaraj Godambe'
    },
    createdAtStr: '2026-10-05 08:45 AM',
    createdAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    timeline: [
      { step: 'Complaint Submitted', date: '2026-10-05 08:45 AM', desc: 'Lodged by student.', author: 'Swaraj Godambe' },
      { step: 'Validated', date: '2026-10-05 10:00 AM', desc: 'Forwarded to Transport Manager.', author: 'System' },
      { step: 'Action Taken', date: '2026-10-05 03:00 PM', desc: 'Driver reprimanded and route timing re-aligned.', author: 'Transport Officer' },
      { step: 'Resolved', date: '2026-10-06 09:00 AM', desc: 'Grievance resolved successfully.', author: 'Transport Officer' }
    ],
    remarks: [
      { author: 'Transport Dept Officer', date: '2026-10-06 09:00 AM', text: 'Driver has been instructed to strictly follow schedule. Alternate backup bus arranged.' }
    ]
  }
];

class StorageService {
  constructor() {
    this.ensureDataFile();
  }

  isMongoOnline() {
    return mongoose.connection && mongoose.connection.readyState === 1;
  }

  ensureDataFile() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      const initialDb = {
        users: INITIAL_USERS,
        complaints: INITIAL_COMPLAINTS,
        departments: INITIAL_DEPARTMENTS,
        auditLogs: [
          {
            id: 'LOG-1',
            action: 'SYSTEM_INIT',
            performedBy: 'System',
            role: 'admin',
            details: 'SCMS Portal Database initialized successfully',
            timestamp: new Date().toISOString()
          }
        ]
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
    }
  }

  readDb() {
    this.ensureDataFile();
    try {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Error reading local database file:', err.message);
      return { users: INITIAL_USERS, complaints: INITIAL_COMPLAINTS, departments: INITIAL_DEPARTMENTS, auditLogs: [] };
    }
  }

  writeDb(db) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('Error saving local database file:', err.message);
      return false;
    }
  }

  // User Management
  getUsers(query = {}) {
    const db = this.readDb();
    let users = db.users || [];
    if (query.role && query.role !== 'ALL') {
      users = users.filter(u => u.role === query.role);
    }
    if (query.department && query.department !== 'ALL') {
      users = users.filter(u => u.department === query.department);
    }
    if (query.search) {
      const s = query.search.toLowerCase();
      users = users.filter(u =>
        (u.name && u.name.toLowerCase().includes(s)) ||
        (u.email && u.email.toLowerCase().includes(s)) ||
        (u.rollNo && u.rollNo.toLowerCase().includes(s))
      );
    }
    return users;
  }

  findUser(predicate) {
    const db = this.readDb();
    return db.users.find(predicate);
  }

  createUser(userData) {
    const db = this.readDb();
    const newUser = {
      _id: `USR-${Math.floor(100 + Math.random() * 900)}`,
      customId: `USR-${Math.floor(100 + Math.random() * 900)}`,
      isActive: true,
      createdAt: new Date().toISOString(),
      ...userData
    };
    db.users.push(newUser);
    this.writeDb(db);
    return newUser;
  }

  updateUser(id, updates) {
    const db = this.readDb();
    const idx = db.users.findIndex(u => u._id === id || u.customId === id || u.id === id);
    if (idx !== -1) {
      db.users[idx] = { ...db.users[idx], ...updates };
      this.writeDb(db);
      return db.users[idx];
    }
    return null;
  }

  deleteUser(id) {
    const db = this.readDb();
    const initialLen = db.users.length;
    db.users = db.users.filter(u => u._id !== id && u.customId !== id && u.id !== id);
    if (db.users.length !== initialLen) {
      this.writeDb(db);
      return true;
    }
    return false;
  }

  // Complaint Management
  getComplaints(query = {}) {
    const db = this.readDb();
    let list = db.complaints || [];

    // Evaluate SLA Overdue
    const now = new Date();
    list.forEach(c => {
      if (c.status !== 'Resolved' && c.status !== 'Closed' && c.slaDeadline) {
        if (now > new Date(c.slaDeadline)) {
          c.isOverdue = true;
        }
      }
    });

    if (query.department && query.department !== 'ALL') {
      list = list.filter(c => c.department === query.department);
    }
    if (query.status && query.status !== 'ALL') {
      list = list.filter(c => c.status === query.status);
    }
    if (query.priority && query.priority !== 'ALL') {
      list = list.filter(c => c.priority === query.priority);
    }
    if (query.isOverdue === 'true' || query.isOverdue === true) {
      list = list.filter(c => c.isOverdue);
    }
    if (query.search) {
      const s = query.search.toLowerCase();
      list = list.filter(c =>
        (c.title && c.title.toLowerCase().includes(s)) ||
        (c.description && c.description.toLowerCase().includes(s)) ||
        (c.id && c.id.toLowerCase().includes(s)) ||
        (c.ticketId && c.ticketId.toLowerCase().includes(s)) ||
        (c.studentName && c.studentName.toLowerCase().includes(s))
      );
    }

    return list;
  }

  findComplaint(id) {
    const db = this.readDb();
    return db.complaints.find(c => c.id === id || c.ticketId === id || c._id === id);
  }

  createComplaint(complaintData) {
    const db = this.readDb();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const ticketId = complaintData.ticketId || complaintData.id || `CMP-2026-${randomNum}`;
    const now = new Date();
    const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Calculate SLA
    let slaHours = 72;
    if (complaintData.priority === 'High') slaHours = 48;
    if (complaintData.priority === 'Low') slaHours = 120;
    const slaDeadline = new Date(now.getTime() + slaHours * 3600 * 1000).toISOString();

    const newComplaint = {
      _id: `COMP-${Date.now()}`,
      ticketId,
      id: ticketId,
      status: 'Pending',
      isOverdue: false,
      escalated: false,
      slaDeadline,
      createdAtStr: dateStr,
      createdAt: now.toISOString(),
      timeline: [
        {
          step: 'Complaint Submitted',
          date: dateStr,
          desc: 'Lodged by student via SCMS Portal.',
          author: complaintData.studentName || 'Student'
        }
      ],
      remarks: [],
      ...complaintData
    };

    db.complaints.unshift(newComplaint);
    this.writeDb(db);
    return newComplaint;
  }

  updateComplaint(id, updates) {
    const db = this.readDb();
    const idx = db.complaints.findIndex(c => c.id === id || c.ticketId === id || c._id === id);
    if (idx !== -1) {
      db.complaints[idx] = { ...db.complaints[idx], ...updates };
      this.writeDb(db);
      return db.complaints[idx];
    }
    return null;
  }

  // Department Management
  getDepartments() {
    const db = this.readDb();
    const complaints = db.complaints || [];

    return (db.departments || INITIAL_DEPARTMENTS).map(dept => {
      const deptComplaints = complaints.filter(c => c.department === dept.code);
      const total = deptComplaints.length;
      const pending = deptComplaints.filter(c => c.status === 'Pending').length;
      const inProgress = deptComplaints.filter(c => c.status === 'In Progress').length;
      const resolved = deptComplaints.filter(c => c.status === 'Resolved' || c.status === 'Closed').length;
      const overdue = deptComplaints.filter(c => c.isOverdue).length;
      const complianceRate = total > 0 ? Math.round(((total - overdue) / total) * 100) : 100;

      return {
        ...dept,
        totalComplaints: total,
        pendingComplaints: pending,
        inProgressComplaints: inProgress,
        resolvedComplaints: resolved,
        overdueComplaints: overdue,
        complianceRate
      };
    });
  }

  // Audit Logging
  logAudit(action, performedBy, role, details, complaintId = null) {
    const db = this.readDb();
    const log = {
      id: `LOG-${Date.now()}`,
      action,
      performedBy,
      role,
      details,
      complaintId,
      timestamp: new Date().toISOString()
    };
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift(log);
    if (db.auditLogs.length > 500) db.auditLogs.pop(); // Keep last 500 logs
    this.writeDb(db);
    return log;
  }

  getAuditLogs(limit = 100) {
    const db = this.readDb();
    return (db.auditLogs || []).slice(0, limit);
  }
}

module.exports = new StorageService();
