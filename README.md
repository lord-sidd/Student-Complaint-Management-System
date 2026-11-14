# Student Complaint Management System (SCMS) - Enterprise MERN Edition

An enterprise-grade, role-based Student Complaint Management System built for **Zeal College of Engineering & Technology**, running on the modern **MERN (MongoDB, Express.js, Vanilla ES6+ Client, Node.js)** stack with **Socket.IO Real-time Sync**, **AI Smart Categorization**, **SLA-based Deadlines & Watchdog Escalation**, **Resolution Feedback (1-5 Stars)**, and **Multi-role Administrative Governance**.

---

## 🌟 Key Features & Capabilities

### 🎓 1. Student Portal
* **Complaint Submission & Tracking:** Unique auto-generated ticket IDs (`CMP-YYYY-XXXX`).
* **AI Smart Assistant:** Analyzes complaint title and description to auto-detect target department, category, and priority with explanation.
* **File Attachments:** Upload supporting evidence, receipts, or screenshots (JPG, PNG, PDF, DOCX up to 5MB) powered by Multer.
* **Interactive Timeline:** Step-by-step visual progression tracking (Submitted → Verified → Investigating → Resolved).
* **Resolution Rating & Feedback:** Interactive 1-5 star rating and comment review submission after ticket is resolved.
* **Strict Privacy Isolation:** Students can strictly view and track only complaints submitted by themselves.

### 🏢 2. Department Officer Workspace
* **Department Queue Management:** Officers access tickets specifically routed to their branch (IT, COMP, INFRA, TRANS, EXAM, HOSTEL).
* **Officer Assignment:** Assign investigating officers and technicians directly to tickets.
* **Status & Priority Upgrades:** Update lifecycle states (`Pending` → `In Progress` → `Resolved` → `Closed`) with audit trail.
* **Official Response Thread:** Post verified official remarks and instructions to students.
* **SLA Monitoring:** Visual alert badges for tickets nearing deadline or breaching SLA.

### ⚡ 3. College Administration Console
* **Campus-wide Governance:** Real-time visibility across all 6 departments and master grievance register.
* **User Management:** Filter, create, edit, and deactivate accounts for Students, Officers, and Admins.
* **Department Health & SLA Compliance:** Live tracking of compliance scores, resolution rates, pending backlogs, and overdue tickets.
* **Exportable Audit Reports:** One-click CSV spreadsheet export (`/api/complaints/export/csv`) and print-ready PDF reports.
* **Interactive Analytics:** HTML5 Canvas donut distribution and status breakdown bar charts.

### 🚀 4. Advanced Real-Time & Automation Architecture
* **Socket.IO Real-time Synchronization:** Instant live notifications, badge updates, and ticket state synchronization across multiple open tabs and devices without page refresh.
* **Automatic SLA Watchdog:** High Priority = 48h SLA, Medium = 72h SLA, Low = 120h SLA. Background watchdog marks tickets past deadline as overdue and auto-escalates past 24h.
* **Nodemailer Alerts:** Email notifications dispatched upon ticket creation and status updates.
* **Resilient Dual-Persistence:** Connects to MongoDB via Mongoose when available, while providing seamless local JSON storage fallback (`backend/data/local_db.json`) so the portal operates reliably in any evaluation environment.

---

## 🏗️ Architecture & File Structure

```text
Mini Project/
├── backend/
│   ├── config/
│   │   └── db.js                 # MongoDB Mongoose connection with auto-seeding
│   ├── controllers/
│   │   ├── authController.js     # JWT login, registration & profile verification
│   │   ├── complaintController.js# CRUD, AI routing, assignment, feedback, CSV & stats
│   │   └── adminController.js    # User management, department health & audit trail
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT verification & strict RBAC authorization
│   │   └── uploadMiddleware.js   # Multer file upload filter (images, PDFs, documents)
│   ├── models/
│   │   ├── User.js               # User model with bcrypt password hashing
│   │   ├── Complaint.js          # Complaint schema with SLA, assignment & feedback
│   │   ├── Department.js         # Department schema with SLA hours & officer details
│   │   └── AuditLog.js           # Comprehensive system audit log
│   ├── routes/
│   │   ├── authRoutes.js         # /api/auth routes
│   │   ├── complaintRoutes.js    # /api/complaints routes
│   │   └── adminRoutes.js        # /api/admin routes
│   ├── services/
│   │   └── storageService.js     # Unified persistent storage engine (Mongo + fallback)
│   ├── utils/
│   │   ├── aiService.js          # Natural language AI categorization engine
│   │   └── emailService.js       # Nodemailer automated email notification service
│   ├── uploads/                  # Multer uploaded attachments directory
│   ├── server.js                 # Express server, Socket.IO, Helmet, rate-limit & watchdog
│   ├── .env                      # Environment configurations (Port, Mongo, JWT)
│   └── package.json              # Backend dependencies
├── app.js                        # Client-side engine with Socket.IO, AI & UI state
├── index.html                    # Responsive glassmorphism portal UI
├── styles.css                    # Modern UI styles, dark/light themes, animations
├── test_e2e.js                   # Automated 10-point E2E regression test suite
└── package.json                  # Root npm project configuration
```

---

## ⚡ Quick Start & Execution

### 1. Start the Server
From the project folder `Mini Project`:
```bash
npm start
```
*Or with nodemon for live hot-reloading:*
```bash
npm run dev
```

The Express server will start on **`http://localhost:5000`**, automatically serving:
* 🌐 **Full-Stack Web Application:** `http://localhost:5000`
* 📡 **REST API:** `http://localhost:5000/api`
* ⚡ **Socket.IO:** `ws://localhost:5000`

### 2. Run Automated End-to-End Tests
To verify all 11 core API workflows and database operations:
```bash
node test_e2e.js
```

---

## 👥 Default Evaluation Login Credentials

Use the fast **1-Click Evaluation Login** buttons on the landing page, or enter credentials manually:

| Role | Email / Identifier | Password | Access Rights |
|---|---|---|---|
| **Student** | `siddhesh@zeal.edu.in` | `student123` | Lodge grievances, AI suggestion, view personal tickets, rate resolution |
| **Dept Officer** | `ithod@zeal.edu.in` | `officer123` | Manage IT department queue, assign officers, update status, add remarks |
| **Administrator** | `admin@zeal.edu.in` | `admin123` | Global analytics, user governance, department health, CSV & print audits |

---

## 📡 REST API Documentation

### 🔐 Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new student profile | No |
| `POST` | `/api/auth/login` | Authenticate student, officer, or admin & return JWT | No |
| `GET` | `/api/auth/me` | Fetch currently authenticated user | Bearer JWT |

### 📋 Complaints & Grievances (`/api/complaints`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/complaints` | Fetch complaints (search, department, status, priority, pagination) | Optional |
| `GET` | `/api/complaints/:id` | Lookup single ticket by Ticket ID (e.g. `CMP-2026-1042`) | Optional |
| `POST` | `/api/complaints` | Submit new grievance (calculates SLA deadline, triggers Socket.IO) | Optional |
| `PUT` | `/api/complaints/:id` | Update status, re-assign department, add official remarks | Optional |
| `PUT` | `/api/complaints/:id/assign` | Assign ticket to specific investigating officer | Optional |
| `POST` | `/api/complaints/:id/feedback` | Submit student satisfaction rating (1-5 stars) and comment | Optional |
| `POST` | `/api/complaints/ai-suggest` | Run AI categorization engine for target department & priority | No |
| `POST` | `/api/complaints/upload` | Upload supporting file attachment via Multer | No |
| `GET` | `/api/complaints/export/csv` | Download complete grievances register as formatted CSV | No |
| `GET` | `/api/complaints/analytics/stats` | System counts, SLA breach metrics & average rating score | No |

### 🛡️ Administration (`/api/admin`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/admin/users` | List registered students, officers, and admins | Admin |
| `POST` | `/api/admin/users` | Create new system account | Admin |
| `PUT` | `/api/admin/users/:id` | Update user department, role, or active status | Admin |
| `DELETE` | `/api/admin/users/:id` | Deactivate/remove user | Admin |
| `GET` | `/api/admin/departments` | Department SLA compliance, total, pending & overdue counts | Admin |
| `GET` | `/api/admin/audit-logs` | Retrieve chronological security audit trail | Admin |

---

## 🛡️ Security & Quality Standards
* **Role-Based Access Control (RBAC):** Verified using JWT tokens with `protect` and `authorize` middlewares.
* **Password Encryption:** Bcrypt hashing with salt rounds.
* **Network & App Protection:** Helmet header protection, express-rate-limit brute-force prevention, and CORS policies.
* **Input Validation & Sanitization:** SQL/NoSQL injection protection and HTML character escaping.
* **Documentation & Clean Code:** Fully modular code adhering to industry production standards.
