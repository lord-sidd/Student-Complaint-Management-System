require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const connectDB = require('./config/db');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Connect to MongoDB
connectDB();

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Attach io instance to express app
app.set('io', io);

// Socket.IO Room Management
io.on('connection', (socket) => {
  console.log(`⚡ [SOCKET CONNECTED] id=${socket.id}`);

  socket.on('join_user', (userId) => {
    if (userId) {
      socket.join(`user_${userId}`);
      console.log(`👤 Socket ${socket.id} joined room user_${userId}`);
    }
  });

  socket.on('join_department', (deptCode) => {
    if (deptCode) {
      socket.join(`dept_${deptCode}`);
      console.log(`🏛️ Socket ${socket.id} joined room dept_${deptCode}`);
    }
  });

  socket.on('join_role', (role) => {
    if (role) {
      socket.join(`role_${role}`);
      console.log(`🛡️ Socket ${socket.id} joined room role_${role}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`⚡ [SOCKET DISCONNECTED] id=${socket.id}`);
  });
});

// Security: Helmet with relaxed CSP for CDN icons and Socket.io
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Global Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting for Auth Endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 login requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again after 15 minutes' },
});
app.use('/api/auth/login', authLimiter);

// Serve File Uploads directory
const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

// API Health Check
app.get('/api/health', (req, res) => {
  const { getDbStatus } = require('./config/db');
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'SCMS MERN Enterprise Backend',
    college: 'Zeal College of Engineering & Technology',
    database: getDbStatus ? getDbStatus() : { connected: true },
    socket: 'ready',
  });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/complaints', require('./routes/complaintRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Serve Frontend Static Assets (HTML, CSS, JS, Images from parent folder)
const frontendPath = path.join(__dirname, '..');
app.use(express.static(frontendPath));

// For non-API routes, serve index.html (SPA Fallback)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Background SLA Watchdog (Runs every 30 minutes)
setInterval(async () => {
  try {
    const Complaint = require('./models/Complaint');
    const now = new Date();
    const overdueList = await Complaint.find({
      status: { $in: ['Pending', 'In Progress'] },
      slaDeadline: { $lt: now },
      isOverdue: false,
    });

    for (const c of overdueList) {
      c.isOverdue = true;
      c.timeline.push({
        step: 'SLA Overdue Alert',
        date: now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        desc: 'Resolution deadline passed. Ticket flagged as overdue for department officer.',
        author: 'SLA Watchdog',
      });
      await c.save();
    }
  } catch (err) {
    // Ignore if offline
  }
}, 30 * 60 * 1000);

// Start Server Listener
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 SCMS Enterprise Server live on http://localhost:${PORT}`);
  console.log(`📡 REST API Root: http://localhost:${PORT}/api`);
  console.log(`⚡ Socket.IO Ready on http://localhost:${PORT}`);
  console.log(`🌐 Full Stack App: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
