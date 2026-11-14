require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Complaint = require('./models/Complaint');
const connectDB = require('./config/db');

const DEFAULT_USERS = [
  {
    customId: 'USR-101',
    name: 'Siddhesh Dhavale',
    email: 'siddhesh@zeal.edu.in',
    rollNo: 'IT2143',
    department: 'IT',
    role: 'student',
    password: 'student123',
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

const INITIAL_DEMO_COMPLAINTS = [
  {
    ticketId: 'CMP-2026-1042',
    title: 'PC #18 Monitor & RAM Failure in IT Lab 3',
    department: 'IT',
    category: 'Academics',
    priority: 'High',
    studentName: 'Siddhesh Dhavale (IT2143)',
    studentEmail: 'siddhesh@zeal.edu.in',
    studentRollNo: 'IT2143',
    userId: 'USR-101',
    description:
      'During the DBMS practical session, PC #18 display kept flickering and randomly rebooted with blue screen error. Kindly replace RAM or display cable before next exam session.',
    attachment: 'error_screenshot_lab3.png',
    status: 'In Progress',
    createdAtStr: '2026-10-08 09:30 AM',
    timeline: [
      { step: 'Complaint Submitted', date: '2026-10-08 09:30 AM', desc: 'Submitted by student via SCMS Portal.' },
      { step: 'Validated & Forwarded', date: '2026-10-08 11:15 AM', desc: 'Verified by Head of IT Dept (Prof. Kulkarni).' },
      { step: 'In Investigation', date: '2026-10-08 02:45 PM', desc: 'Assigned to Lab Assistant for hardware check.' },
    ],
    remarks: [
      {
        author: 'Prof. Kulkarni (HOD IT)',
        date: '2026-10-08 11:15 AM',
        text: 'Ticket verified. Forwarded to Lab Technician Mr. Shinde for immediate RAM check.',
      },
    ],
  },
  {
    ticketId: 'CMP-2026-1043',
    title: 'Wi-Fi Signal Drop in 3rd Floor IT Block',
    department: 'IT',
    category: 'Infrastructure',
    priority: 'Medium',
    studentName: 'Suraj Padwal (IT2123)',
    studentEmail: 'suraj@zeal.edu.in',
    studentRollNo: 'IT2123',
    userId: 'USR-201',
    description:
      'The Wi-Fi access point near Classroom 304 keeps disconnecting every 5 minutes, preventing students from accessing online research portals.',
    attachment: null,
    status: 'Pending',
    createdAtStr: '2026-10-09 10:15 AM',
    timeline: [
      { step: 'Complaint Submitted', date: '2026-10-09 10:15 AM', desc: 'Received in central complaint queue.' },
    ],
    remarks: [],
  },
  {
    ticketId: 'CMP-2026-1039',
    title: 'Route #4 College Bus Delay on Katraj Highway',
    department: 'TRANS',
    category: 'Transportation',
    priority: 'High',
    studentName: 'Swaraj Godambe (IT2132)',
    studentEmail: 'swaraj@zeal.edu.in',
    studentRollNo: 'IT2132',
    userId: 'USR-202',
    description:
      'Route #4 bus arrived 35 minutes late due to unauthorized stop. Students missed the morning 8:30 AM attendance lecture.',
    attachment: 'bus_ticket_route4.pdf',
    status: 'Resolved',
    createdAtStr: '2026-10-05 08:45 AM',
    timeline: [
      { step: 'Complaint Submitted', date: '2026-10-05 08:45 AM', desc: 'Lodged by student.' },
      { step: 'Validated', date: '2026-10-05 10:00 AM', desc: 'Forwarded to Transport Manager.' },
      { step: 'Action Taken', date: '2026-10-05 03:00 PM', desc: 'Driver reprimanded and route timing re-aligned.' },
      { step: 'Resolved', date: '2026-10-06 09:00 AM', desc: 'Grievance resolved successfully.' },
    ],
    remarks: [
      {
        author: 'Transport Dept Officer',
        date: '2026-10-06 09:00 AM',
        text: 'Driver has been instructed to strictly follow schedule. Alternate backup bus arranged.',
      },
    ],
  },
  {
    ticketId: 'CMP-2026-1035',
    title: 'Hostel Block B Hot Water Supply Interruption',
    department: 'HOSTEL',
    category: 'Infrastructure',
    priority: 'Medium',
    studentName: 'Rohan Sharma (COMP3102)',
    studentEmail: 'rohan@zeal.edu.in',
    studentRollNo: 'COMP3102',
    userId: 'USR-203',
    description:
      'Solar water heater unit on 2nd floor Hostel B is leaking water and not heating properly during early morning hours.',
    attachment: 'solar_heater_leak.jpg',
    status: 'In Progress',
    createdAtStr: '2026-10-07 07:20 AM',
    timeline: [
      { step: 'Submitted', date: '2026-10-07 07:20 AM', desc: 'Submitted by Hostel Resident.' },
      { step: 'Forwarded to Maintenance', date: '2026-10-07 09:00 AM', desc: 'Plumbing contractor notified.' },
    ],
    remarks: [
      { author: 'Hostel Rector', date: '2026-10-07 09:00 AM', text: 'Technicians called to replace valve gasket today.' },
    ],
  },
  {
    ticketId: 'CMP-2026-1028',
    title: 'Re-evaluation Mark sheet Delay for Unit Test 1',
    department: 'EXAM',
    category: 'Examinations',
    priority: 'Low',
    studentName: 'Ananya Patil (ENTC2041)',
    studentEmail: 'ananya@zeal.edu.in',
    studentRollNo: 'ENTC2041',
    userId: 'USR-204',
    description:
      'Applied for re-checking of Digital Electronics paper 12 days ago. Corrected marksheet not yet updated on student portal.',
    attachment: null,
    status: 'Resolved',
    createdAtStr: '2026-09-28 02:00 PM',
    timeline: [
      { step: 'Submitted', date: '2026-09-28 02:00 PM', desc: 'Application received.' },
      { step: 'Paper Re-evaluated', date: '2026-09-30 04:00 PM', desc: 'Faculty updated marksheet.' },
      { step: 'Resolved', date: '2026-10-02 11:00 AM', desc: 'Updated marksheet uploaded.' },
    ],
    remarks: [
      {
        author: 'Controller of Exams',
        date: '2026-10-02 11:00 AM',
        text: 'Revised marksheet has been published to student profile (+4 marks added).',
      },
    ],
  },
  {
    ticketId: 'CMP-2026-1021',
    title: 'Projector Bulb Burnt in Classroom 201',
    department: 'INFRA',
    category: 'Infrastructure',
    priority: 'Medium',
    studentName: 'Priya Joshi (IT2109)',
    studentEmail: 'priya@zeal.edu.in',
    studentRollNo: 'IT2109',
    userId: 'USR-205',
    description:
      'During seminar presentations, projector turned off with lamp error indicator glowing red.',
    attachment: null,
    status: 'Closed',
    createdAtStr: '2026-09-25 11:00 AM',
    timeline: [
      { step: 'Submitted', date: '2026-09-25 11:00 AM', desc: 'Registered.' },
      { step: 'Resolved', date: '2026-09-26 04:00 PM', desc: 'Bulb replaced.' },
      { step: 'Closed', date: '2026-09-27 10:00 AM', desc: 'Student confirmed working state.' },
    ],
    remarks: [
      { author: 'Estate Manager', date: '2026-09-26 04:00 PM', text: 'New 4000-lumens projector lamp installed.' },
    ],
  },
];

const seedData = async () => {
  const connected = await connectDB();
  if (!connected) {
    console.error('Cannot seed data without active MongoDB connection.');
    process.exit(1);
  }

  try {
    await User.deleteMany();
    await Complaint.deleteMany();

    // Create users individually so pre('save') password hashing triggers
    for (const u of DEFAULT_USERS) {
      await User.create(u);
    }

    await Complaint.insertMany(INITIAL_DEMO_COMPLAINTS);

    console.log('🎉 Seed successful! Pre-seeded:');
    console.log(`- ${DEFAULT_USERS.length} Default Users`);
    console.log(`- ${INITIAL_DEMO_COMPLAINTS.length} Demo Complaints`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during database seeding:', error);
    process.exit(1);
  }
};

seedData();

