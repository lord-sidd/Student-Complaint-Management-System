const mongoose = require('mongoose');

// Prevent Mongoose from crashing queries immediately if temporarily disconnected
mongoose.set('bufferCommands', false);

let isConnected = false;

const DEFAULT_USERS = [
  {
    customId: 'USR-101',
    name: 'Swaraj Godambe',
    email: 'swaraj@zeal.edu.in',
    rollNo: 'IT2143',
    department: 'IT',
    role: 'student',
    password: 'swaraj@123',
  },
  {
    customId: 'USR-102',
    name: 'Prof. Kulkarni',
    email: 'ithod@zeal.edu.in',
    rollNo: 'STAFF-IT',
    department: 'IT',
    role: 'authority',
    password: 'officer123',
  },
  {
    customId: 'USR-103',
    name: 'College Administration',
    email: 'admin@zeal.edu.in',
    rollNo: 'ADMIN-01',
    department: 'ALL',
    role: 'admin',
    password: 'admin123',
  },
];

const DEFAULT_DEPARTMENTS = [
  { code: 'IT', name: 'Information Technology', headOfficer: 'Prof. Kulkarni', email: 'ithod@zeal.edu.in', slaTargetHours: 48 },
  { code: 'COMP', name: 'Computer Engineering', headOfficer: 'Prof. Sharma', email: 'comphod@zeal.edu.in', slaTargetHours: 48 },
  { code: 'INFRA', name: 'Infrastructure & Estate Maintenance', headOfficer: 'Estate Manager', email: 'infra@zeal.edu.in', slaTargetHours: 72 },
  { code: 'TRANS', name: 'Transportation Authority', headOfficer: 'Transport Head', email: 'transport@zeal.edu.in', slaTargetHours: 48 },
  { code: 'EXAM', name: 'Examination & Evaluation Cell', headOfficer: 'Controller of Exams', email: 'exam@zeal.edu.in', slaTargetHours: 72 },
  { code: 'HOSTEL', name: 'Hostel Amenities & Living', headOfficer: 'Hostel Chief Rector', email: 'hostel@zeal.edu.in', slaTargetHours: 48 },
];

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/scms_db';
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`✅ MongoDB Connected successfully: ${conn.connection.host}`);

    // Auto-seed default users and departments if collection empty
    try {
      const User = require('../models/User');
      const Department = require('../models/Department');
      const Complaint = require('../models/Complaint');

      const userCount = await User.countDocuments();
      if (userCount === 0) {
        console.log('🌱 Seeding default users...');
        for (const u of DEFAULT_USERS) {
          await User.create(u);
        }
        console.log(`✅ ${DEFAULT_USERS.length} default users seeded.`);
      }

      const deptCount = await Department.countDocuments();
      if (deptCount === 0) {
        console.log('🌱 Seeding default departments...');
        await Department.insertMany(DEFAULT_DEPARTMENTS);
        console.log(`✅ ${DEFAULT_DEPARTMENTS.length} default departments seeded.`);
      }
    } catch (seedErr) {
      console.warn('⚠️ Auto-seed check notice:', seedErr.message);
    }

    return true;
  } catch (error) {
    isConnected = false;
    console.warn(`⚠️ MongoDB connection warning: ${error.message}`);
    console.warn('ℹ️ If using local MongoDB or MongoDB Atlas, configure MONGO_URI in backend/.env');
    return false;
  }
};

const getDbStatus = () => ({
  connected: isConnected && mongoose.connection.readyState === 1,
  host: mongoose.connection.host || 'offline',
  readyState: mongoose.connection.readyState,
});

module.exports = connectDB;
module.exports.getDbStatus = getDbStatus;
