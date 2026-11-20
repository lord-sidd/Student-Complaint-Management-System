/**
 * Student Complaint Management System (SCMS) - Zeal College of Engineering
 * Complete Full-Stack Client Engine: Real-time Socket.IO, AI Routing, RBAC & SLA Management
 */

// Global Application State
let complaintsData = [];
let usersData = [];
let departmentsData = [];
let currentUser = null; // null when NOT logged in
let currentTab = 'dashboard';
let currentAdminSubtab = 'analytics';
let selectedComplaintId = null;
let selectedFile = null;
let currentKpiFilter = 'ALL';
let currentStudentPage = 1;
const studentPageSize = 6;
let currentRatingValue = 0;
let socket = null;

// Backend API Configuration
const API_BASE_URL = (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
  ? `${window.location.origin}/api`
  : 'http://localhost:5000/api';
let isBackendOnline = false;

// Authenticated Authorization Header Provider
function getAuthHeaders(extraHeaders = {}) {
  const token = localStorage.getItem('scms_jwt_token');
  return {
    ...extraHeaders,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

// Default Evaluation Users
const DEFAULT_USERS = [
  {
    id: 'USR-101',
    _id: 'USR-101',
    customId: 'USR-101',
    name: 'Swaraj Godambe',
    email: 'swaraj@zeal.edu.in',
    rollNo: 'IT2143',
    department: 'IT',
    role: 'student',
    password: 'swaraj@123',
    isActive: true,
  },
  {
    id: 'USR-102',
    _id: 'USR-102',
    customId: 'USR-102',
    name: 'Prof. Kulkarni',
    email: 'ithod@zeal.edu.in',
    rollNo: 'STAFF-IT',
    department: 'IT',
    role: 'authority',
    password: 'officer123',
    isActive: true,
  },
  {
    id: 'USR-103',
    _id: 'USR-103',
    customId: 'USR-103',
    name: 'College Administration',
    email: 'admin@zeal.edu.in',
    rollNo: 'ADMIN-01',
    department: 'ALL',
    role: 'admin',
    password: 'admin123',
    isActive: true,
  },
];

// Student Complaint Ownership Security Validator
function isComplaintOwnedByStudent(complaint, student) {
  if (!complaint || !student) return false;

  // 1. Direct User ID match
  if (complaint.userId && (student.id || student._id || student.customId)) {
    const sId = student.id || student._id || student.customId;
    if (complaint.userId === sId) return true;
  }

  // 2. Direct Email match
  if (complaint.studentEmail && student.email) {
    if (complaint.studentEmail.trim().toLowerCase() === student.email.trim().toLowerCase()) {
      return true;
    }
  }

  // 3. Roll Number match
  if (student.rollNo && student.rollNo.trim() !== '') {
    const sRoll = student.rollNo.trim().toLowerCase();
    const cName = (complaint.studentName || '').toLowerCase();
    const cRoll = (complaint.studentRollNo || '').toLowerCase();
    if (cRoll === sRoll || cName.includes(sRoll)) {
      return true;
    }
  }

  // 4. Student Name match
  if (student.name && student.name.trim().length >= 3) {
    const sName = student.name.trim().toLowerCase();
    const cName = (complaint.studentName || '').trim().toLowerCase();
    if (cName === sName || cName.startsWith(sName) || cName.includes(sName)) {
      return true;
    }
  }

  return false;
}

// Unique Complaint Identifier & Deduplication Helpers
function getComplaintId(c) {
  if (!c) return '';
  return String(c.ticketId || c.id || '').trim();
}

function deduplicateComplaints(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  for (const c of list) {
    if (!c) continue;
    const cid = String(c.ticketId || c.id || '').trim();
    const mongoId = c._id ? String(c._id).trim() : '';
    const key = cid || mongoId;
    if (!key) {
      result.push(c);
      continue;
    }
    if (!seen.has(key)) {
      seen.add(key);
      if (cid) seen.add(cid);
      if (mongoId) seen.add(mongoId);
      result.push(c);
    }
  }
  return result;
}

function upsertComplaint(complaint, prepend = true) {
  if (!complaint) return;
  const targetId = String(complaint.ticketId || complaint.id || '').trim();
  const mongoId = complaint._id ? String(complaint._id).trim() : '';

  const idx = complaintsData.findIndex(c => {
    const cId = String(c.ticketId || c.id || '').trim();
    if (targetId && cId && targetId === cId) return true;
    if (mongoId && c._id && String(c._id).trim() === mongoId) return true;
    return false;
  });

  if (idx !== -1) {
    // If ticket already exists in client cache, merge new fields in place without duplicating
    complaintsData[idx] = { ...complaintsData[idx], ...complaint };
  } else {
    if (prepend) {
      complaintsData.unshift(complaint);
    } else {
      complaintsData.push(complaint);
    }
  }
  complaintsData = deduplicateComplaints(complaintsData);
}

// Initialize Application on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSocket();
  loadStoredData();
  renderAppViewState();
  setupEventListeners();
});

// Socket.IO Real-time Client Initialization
function initSocket() {
  const socketPill = document.getElementById('socket-status');
  const socketText = document.getElementById('socket-status-text');

  if (typeof io !== 'undefined') {
    try {
      socket = io();

      socket.on('connect', () => {
        if (socketPill) {
          socketPill.className = 'socket-pill live';
          socketPill.title = 'Real-time WebSocket connection active';
        }
        if (socketText) socketText.innerText = 'Live Sync';
        console.log('⚡ Socket.IO connected with ID:', socket.id);

        syncSocketRooms();
      });

      socket.on('disconnect', () => {
        if (socketPill) {
          socketPill.className = 'socket-pill disconnected';
          socketPill.title = 'Offline or disconnected from server';
        }
        if (socketText) socketText.innerText = 'Offline Sync';
      });

      socket.on('complaint:created', (data) => {
        console.log('📡 Real-time complaint created:', data);
        if (!data) return;
        const targetId = data.ticketId || data.id;
        const alreadyPresent = complaintsData.some(c => {
          const cId = c.ticketId || c.id;
          return (targetId && cId && targetId === cId) || (data._id && c._id && String(c._id) === String(data._id));
        });

        upsertComplaint(data, true);
        saveData();
        renderAllViews();

        if (!alreadyPresent && currentUser && (currentUser.role === 'admin' || (currentUser.role === 'authority' && (currentUser.department === 'ALL' || !currentUser.department || currentUser.department === data.department)))) {
          showToast(`🔔 New Grievance Lodged: ${targetId} (${getDeptLabel(data.department)})`, 'info');
        }
      });

      socket.on('complaint:updated', (data) => {
        console.log('📡 Real-time complaint updated:', data);
        if (!data) return;
        upsertComplaint(data, false);
        saveData();
        renderAllViews();

        // If detail modal is open for this ticket, refresh it live!
        if (selectedComplaintId && (selectedComplaintId === data.id || selectedComplaintId === data.ticketId)) {
          openDetailModal(selectedComplaintId);
        }

        // Student owner notification if problem is solved
        const isOwner = currentUser && isComplaintOwnedByStudent(data, currentUser);
        if (isOwner && data.status === 'Resolved') {
          showToast(`🎉 Problem Solved! Your grievance ${data.ticketId || data.id} has been RESOLVED!`, 'success');
        } else if (isOwner) {
          showToast(`⚡ Your Grievance ${data.ticketId || data.id} was updated to '${data.status}'`, 'info');
        } else if (currentUser && (currentUser.role === 'authority' || currentUser.role === 'admin')) {
          showToast(`⚡ Ticket ${data.ticketId || data.id} Updated: ${data.status || 'Remark added'}`, 'info');
        }
      });

      socket.on('notification', (data) => {
        console.log('🔔 Received real-time notification:', data);

        let applies = false;
        if (!currentUser) {
          applies = false;
        } else if (currentUser.role === 'admin') {
          applies = true;
        } else if (currentUser.role === 'authority') {
          applies = (!data.department || data.department === currentUser.department);
        } else if (currentUser.role === 'student') {
          const sId = currentUser.id || currentUser._id || currentUser.customId;
          const sEmail = (currentUser.email || '').toLowerCase();
          if (data.targetUserId && data.targetUserId === sId) applies = true;
          if (data.targetEmail && data.targetEmail === sEmail) applies = true;
          const matchingTicket = complaintsData.find(c => c.ticketId === data.ticketId || c.id === data.ticketId);
          if (matchingTicket && isComplaintOwnedByStudent(matchingTicket, currentUser)) applies = true;
        }

        if (applies) {
          const isResolved = data.status === 'Resolved' || (data.title && data.title.includes('Resolved'));
          showToast(`🔔 ${data.title}: ${data.message}`, isResolved ? 'success' : 'info');
          updateNotificationBadge();
          renderAllViews();
        }
      });

    } catch (err) {
      console.warn('Socket.IO init warning:', err.message);
    }
  }
}

// Sync active user credentials with Socket.IO rooms
function syncSocketRooms() {
  if (socket && socket.connected && currentUser) {
    const userId = currentUser.id || currentUser._id || currentUser.customId;
    if (userId) socket.emit('join_user', userId);
    if (currentUser.email) socket.emit('join_user', currentUser.email.toLowerCase());
    if (currentUser.department) socket.emit('join_department', currentUser.department);
    if (currentUser.role) socket.emit('join_role', currentUser.role);
    console.log(`📡 Synced socket rooms for user ${currentUser.name} (${currentUser.role})`);
  }
}

// Load Persistent Data & Synchronize with Backend API
async function loadStoredData() {
  const storedUsers = localStorage.getItem('scms_users');
  if (storedUsers) {
    try { usersData = JSON.parse(storedUsers); } catch (e) { usersData = DEFAULT_USERS; }
  } else {
    usersData = DEFAULT_USERS;
  }
  // Ensure default student account is synced with Swaraj Godambe
  const studentUserIdx = usersData.findIndex(u => u.id === 'USR-101' || u.customId === 'USR-101');
  if (studentUserIdx !== -1) {
    usersData[studentUserIdx] = { ...usersData[studentUserIdx], ...DEFAULT_USERS[0] };
  } else {
    usersData.unshift(DEFAULT_USERS[0]);
  }

  // Restore session from localStorage if user was previously authenticated
  const storedUser = localStorage.getItem('scms_current_user');
  const storedToken = localStorage.getItem('scms_jwt_token');
  if (storedUser && storedToken) {
    try {
      currentUser = JSON.parse(storedUser);
    } catch (e) {
      currentUser = null;
      localStorage.removeItem('scms_current_user');
    }
  } else {
    currentUser = null;
  }

  // Fetch Complaints from Backend API
  try {
    const res = await fetch(`${API_BASE_URL}/complaints`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        complaintsData = deduplicateComplaints(json.data);
        isBackendOnline = true;
        saveData();
        renderAllViews();
        console.log(`✅ Loaded ${complaintsData.length} unique grievances from Backend API`);
      }
    }
  } catch (err) {
    console.log('ℹ️ Running in local fallback mode:', err.message);
    const storedComplaints = localStorage.getItem('scms_complaints_data');
    if (storedComplaints) {
      try { complaintsData = deduplicateComplaints(JSON.parse(storedComplaints)); } catch (e) { complaintsData = []; }
    }
  }

  // Fetch Departments & Admin Users if logged in as Admin
  if (currentUser && currentUser.role === 'admin') {
    fetchAdminDepartments();
    fetchAdminUsers();
  }
}

function saveData() {
  complaintsData = deduplicateComplaints(complaintsData);
  localStorage.setItem('scms_complaints_data', JSON.stringify(complaintsData));
  localStorage.setItem('scms_users', JSON.stringify(usersData));
  if (currentUser) {
    localStorage.setItem('scms_current_user', JSON.stringify(currentUser));
  } else {
    localStorage.removeItem('scms_current_user');
  }
  updateStats();
  updateNotificationBadge();
}

// Master Render View State Engine (Toggles Landing Login vs Authenticated Workspace)
function renderAppViewState() {
  const loginView = document.getElementById('view-login');
  const authWorkspace = document.getElementById('authenticated-workspace');
  const userProfileBar = document.getElementById('user-profile-bar');
  const notifBtn = document.getElementById('header-notif-btn');

  if (!currentUser) {
    if (loginView) loginView.style.display = 'block';
    if (authWorkspace) authWorkspace.style.display = 'none';
    if (userProfileBar) userProfileBar.style.display = 'none';
    if (notifBtn) notifBtn.style.display = 'none';
    return;
  }

  if (loginView) loginView.style.display = 'none';
  if (authWorkspace) authWorkspace.style.display = 'block';
  if (userProfileBar) userProfileBar.style.display = 'flex';
  if (notifBtn) notifBtn.style.display = 'inline-flex';

  renderHeaderUserProfile();
  applyStrictRoleNavigation();
  syncSocketRooms();
  renderAllViews();
  updateNotificationBadge();
}

// Role Navigation Tabs & Portal Scoping
function applyStrictRoleNavigation() {
  const tabDashboard = document.getElementById('tab-dashboard');
  const tabStudentProfile = document.getElementById('tab-student-profile');
  const tabAuthority = document.getElementById('tab-authority');
  const tabAdmin = document.getElementById('tab-admin');
  const headerProfileBtn = document.getElementById('header-profile-btn');
  const heroActionBtns = document.getElementById('hero-action-buttons');
  const heroTitle = document.getElementById('hero-welcome-title');
  const heroDesc = document.getElementById('hero-welcome-desc');
  const deptFilter = document.getElementById('filter-dept');

  if (tabDashboard) tabDashboard.style.display = 'none';
  if (tabStudentProfile) tabStudentProfile.style.display = 'none';
  if (tabAuthority) tabAuthority.style.display = 'none';
  if (tabAdmin) tabAdmin.style.display = 'none';
  if (headerProfileBtn) headerProfileBtn.style.display = 'none';

  if (!currentUser) return;

  if (currentUser.role === 'student') {
    if (tabDashboard) {
      tabDashboard.style.display = 'inline-flex';
      tabDashboard.innerHTML = '<i class="fa-solid fa-list-check"></i> My Complaints';
    }
    if (tabStudentProfile) {
      tabStudentProfile.style.display = 'inline-flex';
      tabStudentProfile.innerHTML = '<i class="fa-solid fa-id-card"></i> Student Profile';
    }
    if (headerProfileBtn) {
      headerProfileBtn.style.display = 'inline-flex';
    }

    if (deptFilter) deptFilter.style.display = 'none';
    if (heroTitle) heroTitle.innerText = `Welcome, ${currentUser.name}`;
    if (heroDesc) heroDesc.innerText = 'Track your personal submitted grievances, resolution timelines, and student academic profile.';

    if (heroActionBtns) {
      heroActionBtns.innerHTML = `
        <button class="btn-primary" onclick="openNewComplaintModal()">
          <i class="fa-solid fa-circle-plus"></i> Submit New Complaint
        </button>
        <button class="btn-secondary" onclick="switchTab('student-profile')" style="border-color: rgba(255,255,255,0.4); color: #fff;">
          <i class="fa-solid fa-id-card"></i> View Profile
        </button>
      `;
    }

    switchTab('dashboard');

  } else if (currentUser.role === 'authority') {
    const deptName = getDeptLabel(currentUser.department);
    if (tabAuthority) {
      tabAuthority.style.display = 'inline-flex';
      tabAuthority.innerHTML = `<i class="fa-solid fa-building-user"></i> ${deptName} Queue`;
    }

    if (deptFilter) deptFilter.style.display = 'inline-block';
    if (heroTitle) heroTitle.innerText = `${deptName} Officer Workspace`;
    if (heroDesc) heroDesc.innerText = `Manage, investigate, assign, and resolve student grievances filed with ${deptName}.`;

    if (heroActionBtns) {
      heroActionBtns.innerHTML = `
        <span class="synopsis-badge" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; font-size: 0.88rem; padding: 0.5rem 1rem; border-radius: 999px;">
          <i class="fa-solid fa-user-shield"></i> Officer: ${currentUser.name} (${deptName})
        </span>
      `;
    }

    switchTab('authority');

  } else if (currentUser.role === 'admin') {
    if (tabAdmin) {
      tabAdmin.style.display = 'inline-flex';
      tabAdmin.innerHTML = '<i class="fa-solid fa-chart-line"></i> Institutional Analytics';
    }
    if (tabDashboard) {
      tabDashboard.style.display = 'inline-flex';
      tabDashboard.innerHTML = '<i class="fa-solid fa-table-list"></i> Central Grievance Registry';
    }

    if (deptFilter) deptFilter.style.display = 'inline-block';
    if (heroTitle) heroTitle.innerText = 'College Administration Governance Console';
    if (heroDesc) heroDesc.innerText = 'Campus-wide SLA monitoring, department compliance audits, and grievance analytics across all branches.';

    if (heroActionBtns) {
      heroActionBtns.innerHTML = `
        <button class="btn-secondary" onclick="exportComplaintsCSV()" style="margin-right: 0.5rem;">
          <i class="fa-solid fa-file-csv" style="color: #10b981;"></i> Export CSV
        </button>
        <button class="btn-primary" onclick="printOfficialReport()">
          <i class="fa-solid fa-print"></i> Generate Audit Report
        </button>
      `;
    }

    fetchAdminDepartments();
    fetchAdminUsers();
    switchTab('admin');
  }

  const btnFilterSubmit = document.getElementById('btn-student-submit-filter');
  if (btnFilterSubmit) {
    btnFilterSubmit.style.display = (currentUser.role === 'student') ? 'inline-flex' : 'none';
  }
}

// Landing Page Auth Switcher
function switchLandingAuthTab(type) {
  document.querySelectorAll('.auth-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.landing-auth-form').forEach(form => form.style.display = 'none');

  const tabBtn = document.getElementById(`auth-landing-tab-${type}`);
  if (tabBtn) tabBtn.classList.add('active');

  if (type === 'student') document.getElementById('landing-form-student').style.display = 'block';
  if (type === 'authority') document.getElementById('landing-form-authority').style.display = 'block';
  if (type === 'admin') document.getElementById('landing-form-admin').style.display = 'block';
  if (type === 'register') document.getElementById('landing-form-register').style.display = 'block';
}

// Authentication Login Handler
async function handleAuthLogin(e, role) {
  e.preventDefault();
  let idInput = '', passInput = '', deptInput = null;

  if (role === 'student') {
    idInput = document.getElementById('landing-student-id').value.trim().toLowerCase();
    passInput = document.getElementById('landing-student-pass').value;
  } else if (role === 'authority') {
    idInput = document.getElementById('landing-auth-id').value.trim().toLowerCase();
    passInput = document.getElementById('landing-auth-pass').value;
    deptInput = document.getElementById('landing-dept-select').value;
  } else if (role === 'admin') {
    idInput = document.getElementById('landing-admin-id').value.trim().toLowerCase();
    passInput = document.getElementById('landing-admin-pass').value;
  }

  if (!idInput || !passInput) {
    showToast('Please enter both your identifier and password.', 'warning');
    return;
  }

  showLoader('Authenticating credentials...');

  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: idInput, password: passInput, role, department: deptInput })
    });

    const data = await res.json().catch(() => ({}));
    hideLoader();

    if (res.ok && data.success) {
      currentUser = data.user;
      if (data.token) localStorage.setItem('scms_jwt_token', data.token);
      saveData();
      renderAppViewState();
      showToast(`Welcome back, ${currentUser.name}!`, 'success');
      return;
    } else {
      showToast(data.message || 'Invalid credentials. Please verify your email/roll number and password.', 'error');
      return;
    }
  } catch (err) {
    console.warn('Backend offline, trying local accounts:', err.message);
  }

  // Fallback to local accounts ONLY if backend is completely unreachable
  const found = usersData.find(u =>
    (u.email.toLowerCase() === idInput || (u.rollNo && u.rollNo.toLowerCase() === idInput)) &&
    u.role === role &&
    u.password === passInput
  );

  hideLoader();

  if (found) {
    currentUser = found;
    saveData();
    renderAppViewState();
    showToast(`Welcome, ${currentUser.name}! (Offline Mode)`, 'info');
  } else {
    showToast('Login failed: Invalid credentials or account not found.', 'error');
  }
}

// Student Registration Handler
async function handleAuthRegister(e) {
  e.preventDefault();
  const name = document.getElementById('landing-reg-name').value.trim();
  const rollNo = document.getElementById('landing-reg-roll').value.trim();
  const department = document.getElementById('landing-reg-dept').value;
  const email = document.getElementById('landing-reg-email').value.trim();
  const password = document.getElementById('landing-reg-pass').value;

  if (!name || !email || !password) {
    showToast('Please fill out all required fields.', 'warning');
    return;
  }

  showLoader('Creating your student profile...');

  try {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, rollNo, department, password, role: 'student' })
    });

    const data = await res.json().catch(() => ({}));
    hideLoader();

    if (res.ok && data.success) {
      currentUser = data.user;
      if (data.token) localStorage.setItem('scms_jwt_token', data.token);
      usersData.push(currentUser);
      saveData();
      renderAppViewState();
      showToast(`Account registered successfully! Welcome, ${currentUser.name}`, 'success');
      return;
    } else {
      showToast(data.message || 'Registration failed. Email may already be in use.', 'error');
      return;
    }
  } catch (err) {
    console.warn('Network error during registration:', err.message);
  }

  hideLoader();
  showToast('Registration failed: Unable to connect to server.', 'error');
}

// Logout Handler
function handleLogout() {
  currentUser = null;
  localStorage.removeItem('scms_jwt_token');
  localStorage.removeItem('scms_current_user');
  saveData();
  renderAppViewState();
  showToast('Logged out successfully.', 'info');
}

// Header Profile Click — clicking avatar or name opens profile for students
function handleProfileHeaderClick() {
  if (!currentUser) return;
  if (currentUser.role === 'student') {
    switchTab('student-profile');
  }
  // Authority and Admin: clicking name/avatar has no nav action (they have no profile tab)
}

// Render User Profile Header Widget
function renderHeaderUserProfile() {
  const avatarEl = document.getElementById('user-avatar');
  const nameEl = document.getElementById('header-user-name');
  const roleEl = document.getElementById('header-user-role');
  const userInfoText = document.querySelector('.user-info-text');

  if (!currentUser) return;

  const initials = currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'US';
  nameEl.innerText = currentUser.name;

  if (currentUser.avatar) {
    avatarEl.style.backgroundImage = `url(${currentUser.avatar})`;
    avatarEl.style.backgroundSize = 'cover';
    avatarEl.style.backgroundPosition = 'center';
    avatarEl.innerText = '';
  } else {
    avatarEl.style.backgroundImage = '';
    avatarEl.style.backgroundSize = '';
    avatarEl.innerText = initials;
  }

  let roleIcon = 'fa-solid fa-user-graduate';
  let roleLabel = 'Student';
  if (currentUser.role === 'authority') {
    roleIcon = 'fa-solid fa-user-shield';
    roleLabel = `Dept Officer (${currentUser.department || 'IT'})`;
  } else if (currentUser.role === 'admin') {
    roleIcon = 'fa-solid fa-user-gear';
    roleLabel = 'Administrator';
  }

  roleEl.innerHTML = `<i class="${roleIcon}"></i> ${roleLabel}`;

  // Only students get clickable profile nav on avatar/name
  const isStudent = currentUser.role === 'student';
  const cursorStyle = isStudent ? 'pointer' : 'default';
  const titleText = isStudent ? 'Click to view your Profile' : currentUser.name;
  if (avatarEl) { avatarEl.style.cursor = cursorStyle; avatarEl.title = titleText; }
  if (userInfoText) { userInfoText.style.cursor = cursorStyle; userInfoText.title = titleText; }
}

// Main Navigation Tab Switcher
function switchTab(tabId) {
  currentTab = tabId;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.id === `tab-${tabId}`);
  });

  document.querySelectorAll('.view-section').forEach(section => {
    section.classList.toggle('active', section.id === `view-${tabId}`);
  });

  if (tabId === 'dashboard') {
    renderComplaints();
  } else if (tabId === 'student-profile') {
    renderStudentProfile();
  } else if (tabId === 'authority') {
    renderAuthorityView();
  } else if (tabId === 'admin') {
    renderAdminView();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ====================================================================
// Student Profile Implementation (Each Student's Verified Profile)
// ====================================================================

// Render Student Profile View (For Logged in Student)
function renderStudentProfile() {
  if (!currentUser) return;

  // Student Initials and Name
  const initials = currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'ST';
  const largeAvatar = document.getElementById('profile-large-avatar');

  const avatarImg = document.getElementById('profile-avatar-img');
  const avatarInitials = document.getElementById('profile-avatar-initials');

  if (currentUser.avatar && avatarImg) {
    avatarImg.src = currentUser.avatar;
    avatarImg.style.display = 'block';
    if (avatarInitials) avatarInitials.style.display = 'none';
  } else {
    if (avatarImg) avatarImg.style.display = 'none';
    if (avatarInitials) { avatarInitials.style.display = 'block'; avatarInitials.innerText = initials; }
    if (largeAvatar && !avatarImg) largeAvatar.innerText = initials;
  }

  const fullNameEl = document.getElementById('profile-student-fullname');
  if (fullNameEl) fullNameEl.innerText = currentUser.name;

  const rollEl = document.getElementById('profile-meta-roll');
  if (rollEl) rollEl.innerText = currentUser.rollNo || 'Not Set';

  const emailEl = document.getElementById('profile-meta-email');
  if (emailEl) emailEl.innerText = currentUser.email || 'Not Set';

  const deptBadge = document.getElementById('profile-badge-dept');
  if (deptBadge) deptBadge.innerHTML = `<i class="fa-solid fa-graduation-cap"></i> ${getDeptLabel(currentUser.department || 'IT')}`;

  const idBadge = document.getElementById('profile-badge-id');
  if (idBadge) idBadge.innerHTML = `<i class="fa-solid fa-id-card"></i> ID: ${currentUser.id || currentUser.customId || currentUser._id || 'USR-STU'}`;

  // Filter complaints filed by this student
  const studentComplaints = complaintsData.filter(c =>
    (currentUser.email && c.studentEmail && c.studentEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
    (currentUser.rollNo && c.studentRollNo && c.studentRollNo.toLowerCase() === currentUser.rollNo.toLowerCase()) ||
    c.userId === currentUser.id ||
    c.userId === currentUser.customId ||
    c.userId === currentUser._id
  );

  // Stats
  const total = studentComplaints.length;
  const pending = studentComplaints.filter(c => c.status === 'Pending').length;
  const progress = studentComplaints.filter(c => c.status === 'In Progress').length;
  const resolved = studentComplaints.filter(c => c.status === 'Resolved' || c.status === 'Closed').length;

  const stTotal = document.getElementById('prof-stat-total');
  const stPending = document.getElementById('prof-stat-pending');
  const stProgress = document.getElementById('prof-stat-progress');
  const stResolved = document.getElementById('prof-stat-resolved');

  if (stTotal) stTotal.innerText = total;
  if (stPending) stPending.innerText = pending;
  if (stProgress) stProgress.innerText = progress;
  if (stResolved) stResolved.innerText = resolved;

  // Display View Details
  const dispName = document.getElementById('disp-prof-name');
  const dispRoll = document.getElementById('disp-prof-roll');
  const dispDept = document.getElementById('disp-prof-dept');
  const dispYear = document.getElementById('disp-prof-year');
  const dispDiv = document.getElementById('disp-prof-div');
  const dispBatch = document.getElementById('disp-prof-batch');
  const dispEmail = document.getElementById('disp-prof-email');
  const dispPhone = document.getElementById('disp-prof-phone');
  const dispGuardian = document.getElementById('disp-prof-guardian');
  const dispGuardianPhone = document.getElementById('disp-prof-guardian-phone');
  const dispAddress = document.getElementById('disp-prof-address');

  if (dispName) dispName.innerText = currentUser.name || 'Not Provided';
  if (dispRoll) dispRoll.innerText = currentUser.rollNo || 'Not Provided';
  if (dispDept) dispDept.innerText = getDeptLabel(currentUser.department || 'IT');
  if (dispYear) dispYear.innerText = currentUser.academicYear || 'TE (Third Year)';
  if (dispDiv) dispDiv.innerText = currentUser.division ? `Division ${currentUser.division}` : 'Div A';
  if (dispBatch) dispBatch.innerText = currentUser.batchYear || '2023 - 2027';
  if (dispEmail) dispEmail.innerText = currentUser.email || 'Not Provided';
  if (dispPhone) dispPhone.innerText = currentUser.phone || 'Not Provided';
  if (dispGuardian) dispGuardian.innerText = currentUser.guardianName || 'Not Provided';
  if (dispGuardianPhone) dispGuardianPhone.innerText = currentUser.guardianPhone || 'Not Provided';
  if (dispAddress) dispAddress.innerText = currentUser.address || 'Zeal College Campus, Narhe, Pune';

  // Fill Edit Form Fields
  const editName = document.getElementById('edit-prof-name');
  const editRoll = document.getElementById('edit-prof-roll');
  const editDept = document.getElementById('edit-prof-dept');
  const editYear = document.getElementById('edit-prof-year');
  const editDiv = document.getElementById('edit-prof-div');
  const editBatch = document.getElementById('edit-prof-batch');
  const editEmail = document.getElementById('edit-prof-email');
  const editPhone = document.getElementById('edit-prof-phone');
  const editGuardian = document.getElementById('edit-prof-guardian');
  const editGuardianPhone = document.getElementById('edit-prof-guardian-phone');
  const editAddress = document.getElementById('edit-prof-address');

  if (editName) editName.value = currentUser.name || '';
  if (editRoll) editRoll.value = currentUser.rollNo || '';
  if (editDept) editDept.value = currentUser.department || 'IT';
  if (editYear) editYear.value = currentUser.academicYear || 'TE (Third Year)';
  if (editDiv) editDiv.value = currentUser.division || 'A';
  if (editBatch) editBatch.value = currentUser.batchYear || '2023 - 2027';
  if (editEmail) editEmail.value = currentUser.email || '';
  if (editPhone) editPhone.value = currentUser.phone || '';
  if (editGuardian) editGuardian.value = currentUser.guardianName || '';
  if (editGuardianPhone) editGuardianPhone.value = currentUser.guardianPhone || '';
  if (editAddress) editAddress.value = currentUser.address || '';

  // Render recent complaints
  const listContainer = document.getElementById('profile-complaints-list');
  if (listContainer) {
    if (studentComplaints.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
          <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.6;"></i>
          <p>No grievances filed yet.</p>
          <button class="btn-primary btn-sm" onclick="openNewComplaintModal()" style="margin-top: 0.5rem;">
            <i class="fa-solid fa-plus"></i> Submit First Complaint
          </button>
        </div>
      `;
    } else {
      listContainer.innerHTML = studentComplaints.slice(0, 8).map(c => {
        const tId = c.ticketId || c.id;
        return `
          <div class="profile-ticket-mini-card">
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.25rem;">
                <span class="ticket-id" style="font-size: 0.76rem;">${tId}</span>
                <span class="badge ${getStatusBadgeClass(c.status)}" style="font-size: 0.68rem; padding: 0.15rem 0.45rem;">
                  <i class="${getStatusIcon(c.status)}"></i> ${c.status}
                </span>
                <span class="synopsis-badge" style="font-size: 0.68rem; padding: 0.15rem 0.45rem;">
                  ${c.department}
                </span>
              </div>
              <div style="font-size: 0.86rem; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml(c.title)}
              </div>
              <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 0.15rem;">
                <i class="fa-regular fa-clock"></i> ${c.createdAtStr || (new Date(c.createdAt).toLocaleDateString())}
              </div>
            </div>
            <button class="btn-secondary btn-sm" onclick="openDetailModal('${tId}')" style="padding: 0.35rem 0.6rem; font-size: 0.76rem;" title="View Ticket Details">
              <i class="fa-solid fa-eye"></i> View
            </button>
          </div>
        `;
      }).join('');
    }
  }
}

// Handle Student Avatar / Profile Photo Upload
function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast('Image too large. Please select a photo under 2 MB.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = async function(e) {
    const base64 = e.target.result;

    // Update profile avatar in banner
    const avatarImg = document.getElementById('profile-avatar-img');
    const avatarInitials = document.getElementById('profile-avatar-initials');
    if (avatarImg) { avatarImg.src = base64; avatarImg.style.display = 'block'; }
    if (avatarInitials) avatarInitials.style.display = 'none';

    // Update header chip avatar
    const headerAvatar = document.getElementById('user-avatar');
    if (headerAvatar) {
      headerAvatar.style.backgroundImage = `url(${base64})`;
      headerAvatar.style.backgroundSize = 'cover';
      headerAvatar.style.backgroundPosition = 'center';
      headerAvatar.innerText = '';
    }

    // Persist to currentUser and backend
    if (currentUser) currentUser.avatar = base64;
    saveData();

    const token = localStorage.getItem('scms_jwt_token');
    try {
      await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ avatar: base64 })
      });
    } catch (err) {
      console.warn('Avatar save to backend failed:', err);
    }

    showToast('Profile photo updated!', 'success');
  };
  reader.readAsDataURL(file);
}

// Toggle View / Edit Mode in Student Profile
function toggleEditProfileMode(forceState) {
  const viewDetails = document.getElementById('profile-view-details');
  const editForm = document.getElementById('profile-edit-form');
  const indicator = document.getElementById('profile-edit-indicator');
  const toggleBtn = document.getElementById('btn-toggle-edit-profile');

  if (!viewDetails || !editForm) return;

  const isEditing = forceState !== undefined ? forceState : (viewDetails.style.display !== 'none');

  if (isEditing) {
    viewDetails.style.display = 'none';
    editForm.style.display = 'block';
    if (indicator) indicator.innerText = 'Edit Mode';
    if (toggleBtn) {
      toggleBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Cancel Edit';
      toggleBtn.classList.replace('btn-primary', 'btn-secondary');
    }
  } else {
    viewDetails.style.display = 'flex';
    editForm.style.display = 'none';
    if (indicator) indicator.innerText = 'View Mode';
    if (toggleBtn) {
      toggleBtn.innerHTML = '<i class="fa-solid fa-user-pen"></i> Edit Profile';
      toggleBtn.classList.replace('btn-secondary', 'btn-primary');
    }
  }
}

// Save Student Profile via PUT /api/auth/profile
async function saveStudentProfile(e) {
  e.preventDefault();
  if (!currentUser) return;

  const name = document.getElementById('edit-prof-name').value.trim();
  const rollNo = document.getElementById('edit-prof-roll').value.trim();
  const department = document.getElementById('edit-prof-dept').value;
  const academicYear = document.getElementById('edit-prof-year').value;
  const division = document.getElementById('edit-prof-div').value.trim();
  const batchYear = document.getElementById('edit-prof-batch').value.trim();
  const phone = document.getElementById('edit-prof-phone').value.trim();
  const guardianName = document.getElementById('edit-prof-guardian').value.trim();
  const guardianPhone = document.getElementById('edit-prof-guardian-phone').value.trim();
  const address = document.getElementById('edit-prof-address').value.trim();

  showLoader('Saving profile details...');

  const token = localStorage.getItem('scms_jwt_token');

  try {
    const res = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        name,
        rollNo,
        department,
        academicYear,
        division,
        batchYear,
        phone,
        guardianName,
        guardianPhone,
        address,
      })
    });

    if (res.ok) {
      const data = await res.json();
      currentUser = { ...currentUser, ...data.user };
    } else {
      currentUser = {
        ...currentUser,
        name,
        rollNo,
        department,
        academicYear,
        division,
        batchYear,
        phone,
        guardianName,
        guardianPhone,
        address,
      };
    }

    const uIdx = usersData.findIndex(u => (u.id === currentUser.id || u.email === currentUser.email));
    if (uIdx !== -1) {
      usersData[uIdx] = { ...usersData[uIdx], ...currentUser };
    }

    saveData();
    hideLoader();
    toggleEditProfileMode(false);
    renderStudentProfile();
    renderHeaderUserProfile();
    showToast('Student profile updated successfully!', 'success');
  } catch (err) {
    console.warn('Profile save warning:', err);
    currentUser = {
      ...currentUser,
      name,
      rollNo,
      department,
      academicYear,
      division,
      batchYear,
      phone,
      guardianName,
      guardianPhone,
      address,
    };
    saveData();
    hideLoader();
    toggleEditProfileMode(false);
    renderStudentProfile();
    renderHeaderUserProfile();
    showToast('Profile saved successfully.', 'success');
  }
}

// View Any Student's Profile (Modal viewer for Authority & Admin)
async function viewStudentProfile(identifier) {
  if (!identifier) return;

  showLoader('Loading student profile...');
  let student = null;
  let stats = { total: 0, pending: 0, inProgress: 0, resolved: 0 };
  let recentComplaints = [];

  const token = localStorage.getItem('scms_jwt_token');

  try {
    const res = await fetch(`${API_BASE_URL}/auth/student/${encodeURIComponent(identifier)}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });

    if (res.ok) {
      const data = await res.json();
      student = data.student;
      stats = data.stats;
      recentComplaints = data.recentComplaints || [];
    }
  } catch (err) {
    console.warn('Student profile fetch fallback:', err);
  }

  // Fallback to local memory lookup
  if (!student) {
    const clean = identifier.toLowerCase();
    student = usersData.find(u =>
      (u.id && u.id.toLowerCase() === clean) ||
      (u.customId && u.customId.toLowerCase() === clean) ||
      (u.email && u.email.toLowerCase() === clean) ||
      (u.rollNo && u.rollNo.toLowerCase() === clean) ||
      (u.name && u.name.toLowerCase() === clean)
    );

    if (!student) {
      student = {
        name: identifier,
        email: identifier.includes('@') ? identifier : `${identifier}@zeal.edu.in`,
        rollNo: identifier,
        department: 'IT',
        role: 'student',
        academicYear: 'TE (Third Year)',
        division: 'A',
      };
    }

    const sComp = complaintsData.filter(c =>
      (student.email && c.studentEmail && c.studentEmail.toLowerCase() === student.email.toLowerCase()) ||
      (student.rollNo && c.studentRollNo && c.studentRollNo.toLowerCase() === student.rollNo.toLowerCase()) ||
      (c.studentName && c.studentName.toLowerCase().includes(student.name.toLowerCase()))
    );

    stats = {
      total: sComp.length,
      pending: sComp.filter(c => c.status === 'Pending').length,
      inProgress: sComp.filter(c => c.status === 'In Progress').length,
      resolved: sComp.filter(c => c.status === 'Resolved' || c.status === 'Closed').length,
    };
    recentComplaints = sComp.slice(0, 6);
  }

  hideLoader();

  const initials = student.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'ST';
  const modalBody = document.getElementById('modal-student-profile-body');

  modalBody.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.25rem;">
      <!-- Student Header Banner -->
      <div style="display: flex; align-items: center; gap: 1.25rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.25rem;">
        <div class="student-large-avatar" style="width: 60px; height: 60px; font-size: 1.3rem;">${initials}</div>
        <div style="flex: 1;">
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.35rem;">
            <span class="synopsis-badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 700;">
              <i class="fa-solid fa-circle-check"></i> Verified Student
            </span>
            <span class="synopsis-badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8;">
              ${getDeptLabel(student.department || 'IT')}
            </span>
          </div>
          <h3 style="margin: 0; font-size: 1.3rem; color: var(--text-main);">${escapeHtml(student.name)}</h3>
          <p style="margin: 0.2rem 0 0 0; font-size: 0.85rem; color: var(--text-muted);">
            Roll No: <strong>${escapeHtml(student.rollNo || '-')}</strong> • Email: <a href="mailto:${student.email}" style="color: var(--primary);">${escapeHtml(student.email)}</a>
          </p>
        </div>
      </div>

      <!-- Academic & Contact Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div class="profile-detail-row">
          <span class="detail-label"><i class="fa-solid fa-calendar-days"></i> Academic Year</span>
          <span class="detail-val">${escapeHtml(student.academicYear || 'TE (Third Year)')}</span>
        </div>
        <div class="profile-detail-row">
          <span class="detail-label"><i class="fa-solid fa-users-line"></i> Division</span>
          <span class="detail-val">${escapeHtml(student.division ? `Div ${student.division}` : 'Div A')}</span>
        </div>
        <div class="profile-detail-row">
          <span class="detail-label"><i class="fa-solid fa-phone"></i> Mobile Phone</span>
          <span class="detail-val">${escapeHtml(student.phone || 'Not Provided')}</span>
        </div>
        <div class="profile-detail-row">
          <span class="detail-label"><i class="fa-solid fa-timeline"></i> Batch</span>
          <span class="detail-val">${escapeHtml(student.batchYear || '2023 - 2027')}</span>
        </div>
        <div class="profile-detail-row" style="grid-column: span 2;">
          <span class="detail-label"><i class="fa-solid fa-user-shield"></i> Guardian Contact</span>
          <span class="detail-val">${escapeHtml(student.guardianName || 'Guardian')}: ${escapeHtml(student.guardianPhone || 'Not Listed')}</span>
        </div>
      </div>

      <!-- Grievance KPI Strip -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; text-align: center;">
        <div style="background: var(--bg-surface); padding: 0.6rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <div style="font-size: 1.2rem; font-weight: 800; color: var(--primary);">${stats.total}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">Total Filed</div>
        </div>
        <div style="background: var(--bg-surface); padding: 0.6rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <div style="font-size: 1.2rem; font-weight: 800; color: #f59e0b;">${stats.pending}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">Pending</div>
        </div>
        <div style="background: var(--bg-surface); padding: 0.6rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <div style="font-size: 1.2rem; font-weight: 800; color: #0ea5e9;">${stats.inProgress}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">In Progress</div>
        </div>
        <div style="background: var(--bg-surface); padding: 0.6rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <div style="font-size: 1.2rem; font-weight: 800; color: #10b981;">${stats.resolved}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">Resolved</div>
        </div>
      </div>

      <!-- Recent Complaints by this student -->
      <div>
        <h4 style="font-size: 0.95rem; margin: 0 0 0.5rem 0; color: var(--text-main);">
          <i class="fa-solid fa-list-check"></i> Student Grievance Records (${recentComplaints.length})
        </h4>
        ${recentComplaints.length === 0 ? '<p style="font-size: 0.82rem; color: var(--text-muted);">No complaints recorded for this student.</p>' : `
          <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 220px; overflow-y: auto;">
            ${recentComplaints.map(c => `
              <div class="profile-ticket-mini-card">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.2rem;">
                    <span class="ticket-id" style="font-size: 0.72rem;">${c.ticketId || c.id}</span>
                    <span class="badge ${getStatusBadgeClass(c.status)}" style="font-size: 0.65rem; padding: 0.1rem 0.4rem;">
                      ${c.status}
                    </span>
                  </div>
                  <div style="font-size: 0.82rem; font-weight: 600; color: var(--text-main);">${escapeHtml(c.title)}</div>
                </div>
                <button class="btn-secondary btn-sm" onclick="closeModal('modal-student-profile'); openDetailModal('${c.ticketId || c.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.72rem;">
                  Manage
                </button>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  document.getElementById('modal-student-profile').classList.add('active');
}

// Admin Subnavigation Switcher
function switchAdminSubtab(subtabId) {
  currentAdminSubtab = subtabId;

  document.querySelectorAll('.admin-subtab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.id === `admin-subtab-btn-${subtabId}`);
  });

  const subviews = ['analytics', 'complaints', 'users', 'departments'];
  subviews.forEach(s => {
    const el = document.getElementById(`admin-subview-${s}`);
    if (el) el.style.display = (s === subtabId) ? 'block' : 'none';
  });

  if (subtabId === 'analytics') {
    renderCharts();
  } else if (subtabId === 'complaints') {
    renderAdminTable();
  } else if (subtabId === 'users') {
    renderAdminUsers();
  } else if (subtabId === 'departments') {
    renderAdminDepartments();
  }
}

// Interactive KPI Filtering
function filterByKpi(status) {
  if (currentKpiFilter === status && status !== 'ALL') {
    currentKpiFilter = 'ALL';
  } else {
    currentKpiFilter = status;
  }

  document.querySelectorAll('.metric-card').forEach(card => card.classList.remove('active-kpi'));
  if (currentKpiFilter === 'ALL') {
    document.getElementById('kpi-card-total')?.classList.add('active-kpi');
  } else if (currentKpiFilter === 'Pending') {
    document.getElementById('kpi-card-pending')?.classList.add('active-kpi');
  } else if (currentKpiFilter === 'In Progress') {
    document.getElementById('kpi-card-progress')?.classList.add('active-kpi');
  } else if (currentKpiFilter === 'Resolved') {
    document.getElementById('kpi-card-resolved')?.classList.add('active-kpi');
  }

  const filterStatusEl = document.getElementById('filter-status');
  if (filterStatusEl) filterStatusEl.value = currentKpiFilter;

  currentStudentPage = 1;
  renderAllViews();

  const label = currentKpiFilter === 'ALL' ? 'Showing all tickets' : `Filtered by: ${currentKpiFilter}`;
  showToast(label, 'info');
}

// Render Metrics Grid
function updateStats() {
  let dataset = complaintsData;

  if (currentUser) {
    if (currentUser.role === 'student') {
      dataset = complaintsData.filter(c => isComplaintOwnedByStudent(c, currentUser));
    } else if (currentUser.role === 'authority') {
      dataset = complaintsData.filter(c => c.department === currentUser.department);
    }
  }

  const total = dataset.length;
  const pending = dataset.filter(c => c.status === 'Pending').length;
  const progress = dataset.filter(c => c.status === 'In Progress').length;
  const resolved = dataset.filter(c => c.status === 'Resolved' || c.status === 'Closed').length;

  document.getElementById('stat-total')?.replaceChildren(document.createTextNode(total));
  document.getElementById('stat-pending')?.replaceChildren(document.createTextNode(pending));
  document.getElementById('stat-progress')?.replaceChildren(document.createTextNode(progress));
  document.getElementById('stat-resolved')?.replaceChildren(document.createTextNode(resolved));

  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const pendingRate = total > 0 ? Math.round((pending / total) * 100) : 0;
  const progressRate = total > 0 ? Math.round((progress / total) * 100) : 0;

  const totalLabel = document.getElementById('stat-total-label');
  const pendingLabel = document.getElementById('stat-pending-label');
  const progressLabel = document.getElementById('stat-progress-label');
  const resolvedLabel = document.getElementById('stat-resolved-label');

  const totalTrend = document.getElementById('stat-total-trend');
  const pendingTrend = document.getElementById('stat-pending-trend');
  const progressTrend = document.getElementById('stat-progress-trend');
  const resolvedTrend = document.getElementById('stat-resolved-trend');

  if (currentUser && currentUser.role === 'student') {
    if (totalLabel) totalLabel.innerText = 'My Grievances';
    if (totalTrend) totalTrend.innerHTML = '<i class="fa-solid fa-user-check"></i> Applied by you';

    if (pendingLabel) pendingLabel.innerText = 'Awaiting Review';
    if (pendingTrend) pendingTrend.innerHTML = `<i class="fa-solid fa-clock"></i> ${pendingRate}% of yours`;

    if (progressLabel) progressLabel.innerText = 'Under Investigation';
    if (progressTrend) progressTrend.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Active check';

    if (resolvedLabel) resolvedLabel.innerText = 'Resolved';
    if (resolvedTrend) resolvedTrend.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${resolutionRate}% resolved`;
  } else if (currentUser && currentUser.role === 'authority') {
    const deptName = getDeptLabel(currentUser.department);
    if (totalLabel) totalLabel.innerText = `${deptName} Queue`;
    if (totalTrend) totalTrend.innerHTML = '<i class="fa-solid fa-building"></i> Dept Grievances';

    if (pendingLabel) pendingLabel.innerText = 'Needs Action';
    if (pendingTrend) pendingTrend.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${pendingRate}% pending`;

    if (progressLabel) progressLabel.innerText = 'In Investigation';
    if (progressTrend) progressTrend.innerHTML = `<i class="fa-solid fa-gears"></i> ${progressRate}% working`;

    if (resolvedLabel) resolvedLabel.innerText = 'Dept Resolved';
    if (resolvedTrend) resolvedTrend.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${resolutionRate}% resolved`;
  } else {
    if (totalLabel) totalLabel.innerText = 'Total Registered';
    if (totalTrend) totalTrend.innerHTML = '<i class="fa-solid fa-database"></i> Campus-wide';

    if (pendingLabel) pendingLabel.innerText = 'Pending Review';
    if (pendingTrend) pendingTrend.innerHTML = `<i class="fa-solid fa-clock"></i> ${pendingRate}% pending`;

    if (progressLabel) progressLabel.innerText = 'Active Progress';
    if (progressTrend) progressTrend.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> ${progressRate}% ongoing`;

    if (resolvedLabel) resolvedLabel.innerText = 'Resolved Tickets';
    if (resolvedTrend) resolvedTrend.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${resolutionRate}% Resolution Rate`;
  }
}

// Render Student Dashboard Grievance Cards with Pagination
function renderComplaints() {
  complaintsData = deduplicateComplaints(complaintsData);
  updateStats();
  const grid = document.getElementById('complaints-grid');
  const paginationContainer = document.getElementById('student-pagination');
  const searchInput = document.getElementById('search-input');
  const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const deptFilter = document.getElementById('filter-dept')?.value || 'ALL';
  const statusFilterSelect = document.getElementById('filter-status')?.value || 'ALL';
  const effectiveStatus = currentKpiFilter !== 'ALL' ? currentKpiFilter : statusFilterSelect;

  let baseData = complaintsData;
  if (currentUser && currentUser.role === 'student') {
    baseData = complaintsData.filter(c => isComplaintOwnedByStudent(c, currentUser));
  }

  const filtered = baseData.filter(item => {
    const id = (item.ticketId || item.id || '').toLowerCase();
    const title = (item.title || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();
    const matchSearch = id.includes(searchQuery) || title.includes(searchQuery) || desc.includes(searchQuery);
    const matchDept = (currentUser && currentUser.role === 'student') || deptFilter === 'ALL' || item.department === deptFilter;
    const matchStatus = effectiveStatus === 'ALL' || item.status === effectiveStatus;
    return matchSearch && matchDept && matchStatus;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 3rem 1.5rem; text-align: center;">
        <i class="fa-solid fa-folder-open" style="font-size: 2.2rem; color: var(--text-muted); margin-bottom: 0.75rem;"></i>
        <h3 style="color: var(--text-main); margin-bottom: 0.4rem;">
          ${currentUser && currentUser.role === 'student' ? 'No grievances lodged by you yet' : 'No complaints found'}
        </h3>
        <p style="color: var(--text-muted); font-size: 0.9rem;">
          ${currentUser && currentUser.role === 'student' ? 'Click "Submit New Complaint" to register an issue.' : 'Try adjusting your search keywords or status filter.'}
        </p>
      </div>
    `;
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }

  // Pagination Slice
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / studentPageSize) || 1;
  if (currentStudentPage > totalPages) currentStudentPage = totalPages;
  const startIdx = (currentStudentPage - 1) * studentPageSize;
  const pageItems = filtered.slice(startIdx, startIdx + studentPageSize);

  grid.innerHTML = pageItems.map(item => {
    const ticketId = item.ticketId || item.id;
    const isOverdue = checkIsTicketOverdue(item);

    return `
      <div class="complaint-card ${isOverdue ? 'card-overdue' : ''}" style="${item.status === 'Resolved' ? 'border-left: 4px solid #10b981;' : ''}">
        <div>
          <div class="card-header">
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span class="ticket-id">${ticketId}</span>
              ${isOverdue ? '<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; font-size: 0.7rem;"><i class="fa-solid fa-triangle-exclamation"></i> Overdue</span>' : ''}
            </div>
            <span class="badge ${getStatusBadgeClass(item.status)}">
              <i class="${getStatusIcon(item.status)}"></i> ${item.status}
            </span>
          </div>
          ${item.status === 'Resolved' ? `
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-sm); padding: 0.45rem 0.7rem; margin-bottom: 0.65rem; display: flex; align-items: center; justify-content: space-between;">
              <span style="color: #10b981; font-weight: 700; font-size: 0.8rem;">
                <i class="fa-solid fa-circle-check"></i> Problem Solved!
              </span>
              ${(!item.feedback || !item.feedback.rating) ? `
                <button class="btn-primary btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="openDetailModal('${ticketId}')">
                  <i class="fa-solid fa-star"></i> Rate Resolution
                </button>
              ` : `
                <span style="color: #f59e0b; font-size: 0.75rem; font-weight: 600;">
                  <i class="fa-solid fa-star"></i> Rated ${item.feedback.rating}/5
                </span>
              `}
            </div>
          ` : ''}
          <h3 class="card-title">${escapeHtml(item.title)}</h3>
          <p class="card-desc">${escapeHtml(item.description)}</p>
        </div>

        <div class="card-footer">
          <span class="dept-tag"><i class="fa-solid fa-building"></i> ${getDeptLabel(item.department)}</span>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="priority-${(item.priority || 'medium').toLowerCase()}" style="font-size: 0.78rem; font-weight: 700;">
              <i class="fa-solid fa-circle" style="font-size: 0.5rem;"></i> ${item.priority}
            </span>
            <button class="btn-secondary btn-sm" onclick="openDetailModal('${ticketId}')">
              Details <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  renderStudentPagination(totalPages);
}

function checkIsTicketOverdue(item) {
  if (item.status === 'Resolved' || item.status === 'Closed') return false;
  if (item.isOverdue) return true;
  if (item.slaDeadline) {
    return new Date() > new Date(item.slaDeadline);
  }
  return false;
}

function renderStudentPagination(totalPages) {
  const container = document.getElementById('student-pagination');
  if (!container || totalPages <= 1) {
    if (container) container.innerHTML = '';
    return;
  }

  let html = `
    <button class="page-btn" ${currentStudentPage === 1 ? 'disabled' : ''} onclick="setStudentPage(${currentStudentPage - 1})">
      <i class="fa-solid fa-chevron-left"></i> Prev
    </button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    html += `
      <button class="page-btn ${i === currentStudentPage ? 'active' : ''}" onclick="setStudentPage(${i})">${i}</button>
    `;
  }

  html += `
    <button class="page-btn" ${currentStudentPage === totalPages ? 'disabled' : ''} onclick="setStudentPage(${currentStudentPage + 1})">
      Next <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;

  container.innerHTML = html;
}

function setStudentPage(page) {
  currentStudentPage = page;
  renderComplaints();
}

// Render Department Officer View
function renderAuthorityView() {
  complaintsData = deduplicateComplaints(complaintsData);
  updateStats();
  const listContainer = document.getElementById('authority-complaints-list');
  const deptSelect = document.getElementById('authority-dept-select');

  let targetDept = 'IT';
  if (deptSelect && deptSelect.value) {
    targetDept = deptSelect.value;
  } else if (currentUser && currentUser.role === 'authority') {
    targetDept = currentUser.department || 'IT';
    if (deptSelect) deptSelect.value = targetDept;
  }

  const deptItems = complaintsData.filter(c => {
    const matchDept = targetDept === 'ALL' || c.department === targetDept;
    const matchKpi = currentKpiFilter === 'ALL' || c.status === currentKpiFilter;
    return matchDept && matchKpi;
  });

  if (deptItems.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 3rem 1.5rem; text-align: center;">
        <i class="fa-solid fa-circle-check" style="font-size: 2.2rem; color: #10b981; margin-bottom: 0.75rem;"></i>
        <h3 style="color: var(--text-main); margin-bottom: 0.4rem;">No complaints in ${targetDept === 'ALL' ? 'campus queues' : getDeptLabel(targetDept)}</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem;">No active tickets matching the current filter.</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = deptItems.map(item => {
    const ticketId = item.ticketId || item.id;
    const isOverdue = checkIsTicketOverdue(item);

    return `
      <div class="complaint-card" style="border-left: 4px solid var(--secondary);">
        <div>
          <div class="card-header">
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span class="ticket-id">${ticketId}</span>
              ${isOverdue ? '<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; font-size: 0.7rem;"><i class="fa-solid fa-triangle-exclamation"></i> SLA Breach</span>' : ''}
            </div>
            <span class="badge ${getStatusBadgeClass(item.status)}">
              <i class="${getStatusIcon(item.status)}"></i> ${item.status}
            </span>
          </div>
          <h3 class="card-title">${escapeHtml(item.title)}</h3>
          <p style="font-size: 0.8rem; color: var(--text-dark); margin-bottom: 0.4rem;">
            <i class="fa-solid fa-user"></i> Lodged by: <span class="student-link-badge" onclick="event.stopPropagation(); viewStudentProfile('${item.userId || item.studentEmail || item.studentRollNo}')" title="Click to view Student Profile"><strong>${item.studentName}</strong></span> • ${item.createdAtStr || item.createdAt}
          </p>
          <p class="card-desc">${escapeHtml(item.description)}</p>
        </div>

        <div class="card-footer">
          <span class="priority-${(item.priority || 'medium').toLowerCase()}" style="font-size: 0.8rem; font-weight: 700;">
            Priority: ${item.priority}
          </span>
          <button class="btn-primary btn-sm" onclick="openDetailModal('${ticketId}')">
            <i class="fa-solid fa-user-gear"></i> Manage Ticket
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Render Admin Portal View
function renderAdminView() {
  updateStats();
  if (currentAdminSubtab === 'analytics') {
    renderCharts();
  } else if (currentAdminSubtab === 'complaints') {
    renderAdminTable();
  } else if (currentAdminSubtab === 'users') {
    renderAdminUsers();
  } else if (currentAdminSubtab === 'departments') {
    renderAdminDepartments();
  }
}

// Master Grievance Register Table
function renderAdminTable() {
  complaintsData = deduplicateComplaints(complaintsData);
  const tbody = document.getElementById('admin-table-body');
  if (!tbody) return;

  const searchInput = document.getElementById('admin-search-input');
  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const deptFilter = document.getElementById('admin-filter-dept')?.value || 'ALL';
  const priorityFilter = document.getElementById('admin-filter-priority')?.value || 'ALL';

  const items = complaintsData.filter(c => {
    const id = (c.ticketId || c.id || '').toLowerCase();
    const title = (c.title || '').toLowerCase();
    const sName = (c.studentName || '').toLowerCase();
    const matchSearch = id.includes(search) || title.includes(search) || sName.includes(search);
    const matchDept = deptFilter === 'ALL' || c.department === deptFilter;
    const matchPriority = priorityFilter === 'ALL' || c.priority === priorityFilter;
    const matchKpi = currentKpiFilter === 'ALL' || c.status === currentKpiFilter;
    return matchSearch && matchDept && matchPriority && matchKpi;
  });

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No complaints match current filters.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map(item => {
    const ticketId = item.ticketId || item.id;
    const isOverdue = checkIsTicketOverdue(item);
    const slaText = item.slaDeadline ? new Date(item.slaDeadline).toLocaleDateString() : 'N/A';

    return `
      <tr>
        <td><strong class="ticket-id">${ticketId}</strong></td>
        <td><span class="student-link-badge" onclick="viewStudentProfile('${item.userId || item.studentEmail || item.studentRollNo}')" title="Click to view Student Profile"><strong>${escapeHtml(item.studentName)}</strong></span></td>
        <td><span style="font-size: 0.82rem; background: var(--bg-surface); padding: 0.2rem 0.5rem; border-radius: 4px;">${item.category}</span></td>
        <td>${getDeptLabel(item.department)}</td>
        <td>${item.createdAtStr || item.createdAt}</td>
        <td><span class="priority-${(item.priority || 'medium').toLowerCase()}" style="font-weight: 700;">${item.priority}</span></td>
        <td>
          <span style="font-size: 0.8rem; color: ${isOverdue ? '#ef4444' : 'var(--text-muted)'}; font-weight: ${isOverdue ? '700' : '500'};">
            ${isOverdue ? '<i class="fa-solid fa-triangle-exclamation"></i> Overdue' : slaText}
          </span>
        </td>
        <td><span class="badge ${getStatusBadgeClass(item.status)}">${item.status}</span></td>
        <td>
          <button class="btn-secondary btn-sm" onclick="openDetailModal('${ticketId}')">
            <i class="fa-solid fa-eye"></i> View
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Admin User Management
async function fetchAdminUsers() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/users`, {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        usersData = json.data;
        renderAdminUsers();
      }
    }
  } catch (err) {
    console.log('Using local users list:', err.message);
  }
}

function renderAdminUsers() {
  const tbody = document.getElementById('admin-users-table-body');
  if (!tbody) return;

  const searchInput = document.getElementById('user-search-input');
  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const roleFilter = document.getElementById('user-filter-role')?.value || 'ALL';

  const filtered = usersData.filter(u => {
    const name = (u.name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const roll = (u.rollNo || '').toLowerCase();
    const matchSearch = name.includes(search) || email.includes(search) || roll.includes(search);
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">No users found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(u => {
    const userId = u.id || u.customId || u._id;
    let roleBadge = '<span class="badge" style="background:rgba(99,102,241,0.15);color:#818cf8;"><i class="fa-solid fa-user-graduate"></i> Student</span>';
    if (u.role === 'authority') {
      roleBadge = '<span class="badge" style="background:rgba(14,165,233,0.15);color:#38bdf8;"><i class="fa-solid fa-user-shield"></i> Officer</span>';
    } else if (u.role === 'admin') {
      roleBadge = '<span class="badge" style="background:rgba(139,92,246,0.15);color:#c084fc;"><i class="fa-solid fa-shield-halved"></i> Admin</span>';
    }

    const isStudent = u.role === 'student';
    return `
      <tr>
        <td><code>${userId}</code></td>
        <td>
          ${isStudent ? `<span class="student-link-badge" onclick="viewStudentProfile('${userId}')" title="View Student Profile"><strong>${escapeHtml(u.name)}</strong></span>` : `<strong>${escapeHtml(u.name)}</strong>`}
        </td>
        <td>${escapeHtml(u.email)}</td>
        <td>${roleBadge}</td>
        <td>${u.department || 'IT'} / ${u.rollNo || '-'}</td>
        <td><span class="badge badge-resolved"><i class="fa-solid fa-circle-check"></i> Active</span></td>
        <td>
          ${isStudent ? `<button class="btn-secondary btn-sm" onclick="viewStudentProfile('${userId}')" title="View Student Profile" style="color:var(--primary); margin-right: 0.35rem;"><i class="fa-solid fa-id-card"></i></button>` : ''}
          <button class="btn-secondary btn-sm" onclick="deleteAdminUser('${userId}')" style="color:#ef4444;" title="Delete User">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function openAdminUserModal() {
  document.getElementById('form-admin-user').reset();
  document.getElementById('modal-admin-user').classList.add('active');
}

function handleAdminRoleChange() {
  const role = document.getElementById('admin-user-role').value;
  const deptSelect = document.getElementById('admin-user-dept');
  if (role === 'admin') {
    deptSelect.value = 'ALL';
  } else if (deptSelect.value === 'ALL') {
    deptSelect.value = 'IT';
  }
}

async function handleAdminUserSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('admin-user-name').value.trim();
  const email = document.getElementById('admin-user-email').value.trim();
  const role = document.getElementById('admin-user-role').value;
  const department = document.getElementById('admin-user-dept').value;
  const rollNo = document.getElementById('admin-user-roll').value.trim();
  const password = document.getElementById('admin-user-pass').value;

  showLoader('Creating user account...');

  try {
    const res = await fetch(`${API_BASE_URL}/admin/users`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name, email, role, department, rollNo, password })
    });
    if (res.ok) {
      const json = await res.json();
      hideLoader();
      closeModal('modal-admin-user');
      showToast(`User ${name} created successfully!`, 'success');
      fetchAdminUsers();
      return;
    }
  } catch (err) {
    console.log('Local user fallback creation:', err.message);
  }

  hideLoader();
  const newUser = {
    id: `USR-${Math.floor(100 + Math.random() * 900)}`,
    name,
    email,
    role,
    department,
    rollNo,
    password,
    isActive: true,
  };
  usersData.unshift(newUser);
  saveData();
  closeModal('modal-admin-user');
  renderAdminUsers();
  showToast(`User ${name} saved locally!`, 'success');
}

async function deleteAdminUser(id) {
  if (!confirm(`Are you sure you want to remove user ${id}?`)) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      showToast('User removed successfully', 'success');
      fetchAdminUsers();
      return;
    }
  } catch (err) {
    console.log('Local delete fallback:', err.message);
  }

  usersData = usersData.filter(u => (u.id || u._id || u.customId) !== id);
  saveData();
  renderAdminUsers();
  showToast('User deleted from local store', 'info');
}

// Department Health & SLA Compliance
async function fetchAdminDepartments() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/departments`, {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        departmentsData = json.data;
        renderAdminDepartments();
      }
    }
  } catch (err) {
    console.log('Departments fetch fallback:', err.message);
  }
}

function renderAdminDepartments() {
  const container = document.getElementById('admin-departments-grid');
  if (!container) return;

  const defaultDepts = [
    { code: 'IT', name: 'Information Technology', headOfficer: 'Prof. Kulkarni', email: 'ithod@zeal.edu.in', slaTargetHours: 48 },
    { code: 'COMP', name: 'Computer Engineering', headOfficer: 'Prof. Sharma', email: 'comphod@zeal.edu.in', slaTargetHours: 48 },
    { code: 'INFRA', name: 'Infrastructure & Estate Maintenance', headOfficer: 'Estate Manager', email: 'infra@zeal.edu.in', slaTargetHours: 72 },
    { code: 'TRANS', name: 'Transportation Authority', headOfficer: 'Transport Head', email: 'transport@zeal.edu.in', slaTargetHours: 48 },
    { code: 'EXAM', name: 'Examination & Evaluation Cell', headOfficer: 'Controller of Exams', email: 'exam@zeal.edu.in', slaTargetHours: 72 },
    { code: 'HOSTEL', name: 'Hostel Amenities & Living', headOfficer: 'Hostel Chief Rector', email: 'hostel@zeal.edu.in', slaTargetHours: 48 },
  ];

  const source = departmentsData.length > 0 ? departmentsData : defaultDepts;

  container.innerHTML = source.map(dept => {
    const deptComplaints = complaintsData.filter(c => c.department === dept.code);
    const total = deptComplaints.length;
    const pending = deptComplaints.filter(c => c.status === 'Pending').length;
    const resolved = deptComplaints.filter(c => c.status === 'Resolved' || c.status === 'Closed').length;
    const overdue = deptComplaints.filter(c => checkIsTicketOverdue(c)).length;
    const complianceRate = total > 0 ? Math.round(((total - overdue) / total) * 100) : 100;

    return `
      <div class="dept-health-card">
        <div class="dept-health-header">
          <div>
            <span class="ticket-id">${dept.code}</span>
            <div class="dept-health-title">${dept.name}</div>
          </div>
          <span class="dept-compliance-badge ${complianceRate >= 80 ? 'compliance-high' : 'compliance-low'}">
            ${complianceRate}% SLA Score
          </span>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">
          <i class="fa-solid fa-user-shield"></i> HOD: <strong>${dept.headOfficer}</strong> (${dept.email})
        </p>
        <p style="font-size: 0.78rem; color: var(--text-dark); margin-bottom: 0.5rem;">
          <i class="fa-solid fa-stopwatch"></i> SLA Target: ${dept.slaTargetHours} hours
        </p>

        <div class="dept-metrics-row">
          <div>
            <div class="dept-metric-num">${total}</div>
            <div class="dept-metric-label">Total Tickets</div>
          </div>
          <div>
            <div class="dept-metric-num" style="color: #f59e0b;">${pending}</div>
            <div class="dept-metric-label">Pending</div>
          </div>
          <div>
            <div class="dept-metric-num" style="color: ${overdue > 0 ? '#ef4444' : '#10b981'};">${overdue}</div>
            <div class="dept-metric-label">${overdue > 0 ? 'Overdue' : 'Zero Breaches'}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// CSV Export
function exportComplaintsCSV() {
  showToast('Generating CSV Grievance Export...', 'info');
  window.location.href = `${API_BASE_URL}/complaints/export/csv`;
}

// AI Smart Suggestion
async function runAiSuggestion() {
  const title = document.getElementById('comp-title').value.trim();
  const desc = document.getElementById('comp-desc').value.trim();

  if (!title && !desc) {
    showToast('Please type a title or description first so AI can analyze the problem.', 'error');
    return;
  }

  const btn = document.getElementById('btn-ai-suggest');
  const box = document.getElementById('ai-suggestion-box');
  if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...';

  try {
    const res = await fetch(`${API_BASE_URL}/complaints/ai-suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description: desc })
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.suggestion) {
        const s = json.suggestion;

        document.getElementById('comp-dept').value = s.department;
        document.getElementById('comp-category').value = s.category;
        document.getElementById('comp-priority').value = s.priority;

        if (box) {
          box.style.display = 'block';
          box.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
              <span class="badge" style="background: rgba(139, 92, 246, 0.25); color: #c084fc; font-weight: 700;">
                <i class="fa-solid fa-brain"></i> AI Match: ${s.confidence}% Confidence
              </span>
              <span style="font-size: 0.78rem; color: var(--text-muted);">${s.departmentName}</span>
            </div>
            <p style="font-size: 0.82rem; color: var(--text-main); margin: 0;">${s.explanation}</p>
          `;
        }

        showToast(`AI Assigned: ${s.departmentName} (${s.priority} Priority)`, 'success');
      }
    }
  } catch (err) {
    console.warn('AI suggestion fallback:', err.message);
  } finally {
    if (btn) btn.innerHTML = '<i class="fa-solid fa-brain"></i> ⚡ Auto-Detect with AI';
  }
}

// File Selection & Upload
function handleFileSelect(e) {
  if (e.target.files && e.target.files[0]) {
    selectedFile = e.target.files[0];
    const previewContainer = document.getElementById('file-preview-container');
    const previewName = document.getElementById('file-preview-name');
    const previewSize = document.getElementById('file-preview-size');

    if (previewContainer) previewContainer.style.display = 'flex';
    if (previewName) previewName.innerText = selectedFile.name;
    if (previewSize) previewSize.innerText = `(${Math.round(selectedFile.size / 1024)} KB)`;
    document.getElementById('file-label').innerText = `Selected: ${selectedFile.name}`;
  }
}

function clearSelectedFile(e) {
  if (e) e.stopPropagation();
  selectedFile = null;
  const fileInput = document.getElementById('file-upload');
  if (fileInput) fileInput.value = '';
  const previewContainer = document.getElementById('file-preview-container');
  if (previewContainer) previewContainer.style.display = 'none';
  document.getElementById('file-label').innerText = 'Click to select photo/PDF attachment or drag and drop';
}

// Complaint Submission
let isSubmittingComplaint = false;

async function handleComplaintSubmit(e) {
  if (e) e.preventDefault();
  if (isSubmittingComplaint) return;
  isSubmittingComplaint = true;

  const submitBtn = document.querySelector('#form-complaint button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
  }

  try {
    const title = document.getElementById('comp-title').value.trim();
    const department = document.getElementById('comp-dept').value;
    const category = document.getElementById('comp-category').value;
    const priority = document.getElementById('comp-priority').value;
    const studentName = document.getElementById('comp-student-name').value.trim() || (currentUser ? currentUser.name : 'Student User');
    const description = document.getElementById('comp-desc').value.trim();

    showLoader('Submitting grievance to central authority...');

    let uploadedFileName = selectedFile ? selectedFile.name : null;

    // Real File Upload to Multer backend
    if (selectedFile) {
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('attachment', selectedFile);
        const upRes = await fetch(`${API_BASE_URL}/complaints/upload`, {
          method: 'POST',
          body: formData,
        });
        if (upRes.ok) {
          const upJson = await upRes.json();
          if (upJson.filename) uploadedFileName = upJson.filename;
        }
      } catch (upErr) {
        console.warn('File upload note:', upErr.message);
      }
    }

    // Attempt MERN API Submission
    try {
      const token = localStorage.getItem('scms_jwt_token');
      const res = await fetch(`${API_BASE_URL}/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          title,
          department,
          category,
          priority,
          studentName: (currentUser && currentUser.name) ? currentUser.name : studentName,
          studentEmail: (currentUser && currentUser.email) ? currentUser.email : '',
          studentRollNo: (currentUser && currentUser.rollNo) ? currentUser.rollNo : '',
          userId: currentUser ? (currentUser.id || currentUser._id || currentUser.customId) : null,
          description,
          attachment: uploadedFileName
        })
      });
      if (res.ok) {
        const json = await res.json();
        hideLoader();
        if (json && json.data) {
          upsertComplaint(json.data, true);
          saveData();
          resetComplaintForm();
          closeModal('modal-new-complaint');
          renderAllViews();
          showToast(`Grievance submitted successfully! Ticket ID: ${json.data.ticketId || json.data.id}`, 'success');
          return;
        }
      }
    } catch (err) {
      console.log('Local fallback submission:', err.message);
    }

    hideLoader();

    // Local fallback ticket creation
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const newId = `CMP-2026-${randomNum}`;
    const now = new Date();
    const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let slaHours = 72;
    if (priority === 'High') slaHours = 48;
    if (priority === 'Low') slaHours = 120;
    const slaDeadline = new Date(now.getTime() + slaHours * 3600 * 1000).toISOString();

    const newComplaint = {
      id: newId,
      ticketId: newId,
      title,
      department,
      category,
      priority,
      studentName: (currentUser && currentUser.name) ? currentUser.name : studentName,
      studentEmail: (currentUser && currentUser.email) ? currentUser.email : '',
      studentRollNo: (currentUser && currentUser.rollNo) ? currentUser.rollNo : '',
      userId: currentUser ? (currentUser.id || currentUser._id || currentUser.customId) : null,
      description,
      attachment: uploadedFileName,
      status: 'Pending',
      createdAtStr: dateStr,
      createdAt: now.toISOString(),
      slaDeadline,
      isOverdue: false,
      timeline: [
        { step: 'Complaint Submitted', date: dateStr, desc: 'Lodged by student via SCMS Portal.', author: studentName }
      ],
      remarks: []
    };

    upsertComplaint(newComplaint, true);
    saveData();
    resetComplaintForm();
    closeModal('modal-new-complaint');
    renderAllViews();
    showToast(`Grievance submitted successfully! ID: ${newId}`, 'success');
  } finally {
    isSubmittingComplaint = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Grievance';
    }
  }
}

function resetComplaintForm() {
  document.getElementById('form-complaint').reset();
  clearSelectedFile();
  const box = document.getElementById('ai-suggestion-box');
  if (box) box.style.display = 'none';
}

// Open Detail Modal
function openDetailModal(id) {
  selectedComplaintId = id;
  const item = complaintsData.find(c => c.id === id || c.ticketId === id);
  if (!item) return;

  // Strict privacy check for student:
  if (currentUser && currentUser.role === 'student') {
    if (!isComplaintOwnedByStudent(item, currentUser)) {
      showToast('Access restricted: You can only view complaints applied by yourself.', 'error');
      return;
    }
  }

  const ticketId = item.ticketId || item.id;
  document.getElementById('detail-ticket-id').innerText = ticketId;
  document.getElementById('detail-title').innerText = item.title;
  document.getElementById('detail-dept').innerText = getDeptLabel(item.department);
  document.getElementById('detail-student').innerText = item.studentName;
  document.getElementById('detail-desc').innerText = item.description;

  const prioEl = document.getElementById('detail-priority');
  prioEl.innerText = item.priority;
  prioEl.className = `priority-${(item.priority || 'medium').toLowerCase()}`;

  const statusEl = document.getElementById('detail-status-badge');
  statusEl.innerText = item.status;
  statusEl.className = `badge ${getStatusBadgeClass(item.status)}`;

  // SLA & Overdue Display
  const isOverdue = checkIsTicketOverdue(item);
  const overdueBanner = document.getElementById('detail-overdue-banner');
  if (overdueBanner) overdueBanner.style.display = isOverdue ? 'block' : 'none';

  const slaBadge = document.getElementById('detail-sla-badge');
  if (slaBadge) {
    const targetHours = item.priority === 'High' ? '48h' : item.priority === 'Low' ? '120h' : '72h';
    slaBadge.innerHTML = `<i class="fa-solid fa-stopwatch"></i> SLA: ${targetHours} Target`;
  }

  // Assigned Officer Box
  const assignedBox = document.getElementById('detail-assigned-box');
  const assignedText = document.getElementById('detail-assigned-text');
  if (item.assignedTo && item.assignedTo.name) {
    if (assignedBox) assignedBox.style.display = 'flex';
    if (assignedText) assignedText.innerText = `${item.assignedTo.name} (${item.assignedTo.role || 'Investigating Officer'})`;
  } else {
    if (assignedBox) assignedBox.style.display = 'none';
  }

  // Attachment Link
  const attContainer = document.getElementById('detail-attachment-container');
  if (item.attachment) {
    attContainer.style.display = 'block';
    const link = document.getElementById('detail-attachment-name');
    link.innerText = item.attachment;
  } else {
    attContainer.style.display = 'none';
  }

  // Progress Timeline
  const timelineEl = document.getElementById('detail-timeline');
  timelineEl.innerHTML = (item.timeline || []).map((step, idx) => {
    const isLast = idx === item.timeline.length - 1;
    const isCompleted = !isLast || item.status === 'Resolved' || item.status === 'Closed';
    const statusClass = isLast && item.status !== 'Resolved' && item.status !== 'Closed' ? 'active' : (isCompleted ? 'completed' : '');

    return `
      <div class="timeline-step ${statusClass}">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-title">
            <span>${step.step}</span>
            <span class="timeline-date">${step.date}</span>
          </div>
          <p class="timeline-desc">${step.desc}</p>
        </div>
      </div>
    `;
  }).join('');

  // Official Remarks Thread
  const remarksEl = document.getElementById('detail-remarks');
  if (!item.remarks || item.remarks.length === 0) {
    remarksEl.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-dark); font-style: italic;">No official remarks added yet.</p>';
  } else {
    remarksEl.innerHTML = item.remarks.map(r => `
      <div class="remark-bubble authority">
        <div class="remark-header">
          <span><i class="fa-solid fa-user-shield"></i> ${r.author}</span>
          <span>${r.date}</span>
        </div>
        <p>${r.text}</p>
      </div>
    `).join('');
  }

  // Student Feedback Section
  renderDetailFeedback(item);

  // Authority & Admin Action Controls
  const authBox = document.getElementById('authority-action-box');
  if (currentUser && (currentUser.role === 'authority' || currentUser.role === 'admin')) {
    authBox.style.display = 'block';
    document.getElementById('update-status-select').value = item.status;
    document.getElementById('update-dept-select').value = item.department;
    document.getElementById('update-remark-text').value = '';
    const offNameInput = document.getElementById('update-officer-name');
    const offRoleInput = document.getElementById('update-officer-role');
    if (offNameInput) offNameInput.value = item.assignedTo?.name || '';
    if (offRoleInput) offRoleInput.value = item.assignedTo?.role || '';
  } else {
    authBox.style.display = 'none';
  }

  document.getElementById('modal-detail').classList.add('active');
}

// Student Resolution Feedback Rating
function renderDetailFeedback(item) {
  const section = document.getElementById('detail-feedback-section');
  const displayBox = document.getElementById('detail-feedback-display');
  const formBox = document.getElementById('detail-feedback-form');

  if (!section) return;

  const isResolvedOrClosed = item.status === 'Resolved' || item.status === 'Closed';

  if (!isResolvedOrClosed) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  if (item.feedback && item.feedback.rating) {
    if (displayBox) {
      displayBox.style.display = 'block';
      let starsHtml = '';
      for (let i = 1; i <= 5; i++) {
        starsHtml += i <= item.feedback.rating
          ? '<i class="fa-solid fa-star" style="color:#f59e0b;"></i> '
          : '<i class="fa-regular fa-star" style="color:#64748b;"></i> ';
      }
      displayBox.innerHTML = `
        <div style="background:var(--bg-card);padding:0.85rem;border-radius:var(--radius-sm);border:1px solid var(--border-color);">
          <div style="font-size:1.1rem;margin-bottom:0.3rem;">${starsHtml} <span style="font-size:0.85rem;font-weight:700;">${item.feedback.rating} / 5 Stars</span></div>
          <p style="font-size:0.85rem;margin:0;color:var(--text-main);">${escapeHtml(item.feedback.comment || 'Student expressed satisfaction with resolution.')}</p>
        </div>
      `;
    }
    if (formBox) formBox.style.display = 'none';
  } else {
    if (displayBox) displayBox.style.display = 'none';
    if (formBox) {
      formBox.style.display = (currentUser && currentUser.role === 'student') ? 'block' : 'none';
      currentRatingValue = 0;
      updateStarIcons();
    }
  }
}

function setFeedbackRating(val) {
  currentRatingValue = val;
  updateStarIcons();
  const label = document.getElementById('feedback-rating-score');
  if (label) label.innerText = `${val} Star${val > 1 ? 's' : ''}`;
}

function updateStarIcons() {
  for (let i = 1; i <= 5; i++) {
    const star = document.querySelector(`#feedback-star-rating i[data-val="${i}"]`);
    if (star) {
      if (i <= currentRatingValue) {
        star.className = 'fa-solid fa-star';
      } else {
        star.className = 'fa-regular fa-star';
      }
    }
  }
}

async function submitResolutionFeedback() {
  if (!selectedComplaintId) return;
  if (currentRatingValue < 1) {
    showToast('Please tap the stars to rate your resolution satisfaction.', 'error');
    return;
  }

  const comment = document.getElementById('feedback-comment-input').value.trim();
  const item = complaintsData.find(c => c.id === selectedComplaintId || c.ticketId === selectedComplaintId);
  if (!item) return;

  showLoader('Saving feedback rating...');

  try {
    const res = await fetch(`${API_BASE_URL}/complaints/${item.ticketId || item.id}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating: currentRatingValue,
        comment,
        studentName: currentUser ? currentUser.name : item.studentName
      })
    });
    if (res.ok) {
      const json = await res.json();
      hideLoader();
      item.feedback = json.data;
      saveData();
      renderDetailFeedback(item);
      showToast('Thank you for rating our resolution service!', 'success');
      return;
    }
  } catch (err) {
    console.log('Local feedback save fallback:', err.message);
  }

  hideLoader();
  item.feedback = {
    rating: currentRatingValue,
    comment,
    submittedAt: new Date().toISOString(),
    studentName: currentUser ? currentUser.name : item.studentName
  };
  saveData();
  renderDetailFeedback(item);
  showToast('Feedback saved! Thank you.', 'success');
}

// Authority Remark & Status Update
async function submitAuthorityUpdate() {
  if (!selectedComplaintId) return;
  const item = complaintsData.find(c => c.id === selectedComplaintId || c.ticketId === selectedComplaintId);
  if (!item) return;

  const newStatus = document.getElementById('update-status-select').value;
  const newDept = document.getElementById('update-dept-select').value;
  const remarkText = document.getElementById('update-remark-text').value.trim();
  const officerName = document.getElementById('update-officer-name')?.value.trim();
  const officerRole = document.getElementById('update-officer-role')?.value.trim();

  showLoader('Updating grievance record...');

  // Officer Assignment if provided
  if (officerName) {
    try {
      await fetch(`${API_BASE_URL}/complaints/${item.ticketId || item.id}/assign`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ officerName, officerRole })
      });
      item.assignedTo = { name: officerName, role: officerRole || 'Officer' };
    } catch (e) {
      console.warn('Assign fallback note:', e.message);
    }
  }

  try {
    const res = await fetch(`${API_BASE_URL}/complaints/${item.ticketId || item.id}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        status: newStatus,
        department: newDept,
        remarkText,
        officerName: currentUser ? currentUser.name : 'Officer'
      })
    });
    if (res.ok) {
      const json = await res.json();
      hideLoader();
      if (json && json.data) {
        const idx = complaintsData.findIndex(c => c.id === item.id || c.ticketId === item.ticketId);
        if (idx !== -1) complaintsData[idx] = { ...complaintsData[idx], ...json.data };
        saveData();
        closeModal('modal-detail');
        renderAllViews();
        showToast(`Updated ticket ${item.ticketId || item.id} to '${newStatus}'`, 'success');
        return;
      }
    }
  } catch (err) {
    console.log('Local update fallback:', err.message);
  }

  hideLoader();

  const now = new Date();
  const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (item.status !== newStatus) {
    item.status = newStatus;
    item.timeline.push({
      step: `Status updated to ${newStatus}`,
      date: dateStr,
      desc: `Status updated by ${currentUser ? currentUser.name : 'Officer'}.`
    });
  }

  if (item.department !== newDept) {
    item.department = newDept;
    item.timeline.push({
      step: `Re-routed to ${getDeptLabel(newDept)}`,
      date: dateStr,
      desc: 'Ticket re-assigned by officer.'
    });
  }

  if (remarkText) {
    if (!item.remarks) item.remarks = [];
    item.remarks.push({
      author: `${currentUser ? currentUser.name : 'Officer'} (${getDeptLabel(item.department)})`,
      date: dateStr,
      text: remarkText
    });
  }

  saveData();
  closeModal('modal-detail');
  renderAllViews();
  showToast(`Updated ticket ${item.ticketId || item.id} to '${newStatus}'`, 'success');
}

// Global Canvas Analytics Charts
function renderCharts() {
  renderDeptChart();
  renderStatusChart();
}

function renderDeptChart() {
  const canvas = document.getElementById('chart-dept');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.clientWidth || 320;
  canvas.height = canvas.parentElement.clientHeight || 240;

  const counts = {};
  complaintsData.forEach(c => { counts[c.department] = (counts[c.department] || 0) + 1; });

  const labels = Object.keys(counts).map(getDeptLabel);
  const data = Object.values(counts);
  const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
  const total = data.reduce((a, b) => a + b, 0) || 1;
  const centerX = canvas.width / 3;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 20;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let startAngle = 0;
  data.forEach((val, i) => {
    const sliceAngle = (val / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.arc(centerX, centerY, radius * 0.55, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    startAngle += sliceAngle;
  });

  const legendX = canvas.width * 0.62;
  let legendY = 25;

  labels.forEach((label, i) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(legendX, legendY, 12, 12);

    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-main').trim() || '#ffffff';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillText(`${label}: ${data[i]} (${Math.round((data[i] / total) * 100)}%)`, legendX + 18, legendY + 10);

    legendY += 24;
  });
}

function renderStatusChart() {
  const canvas = document.getElementById('chart-status');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.clientWidth || 320;
  canvas.height = canvas.parentElement.clientHeight || 240;

  const statuses = ['Pending', 'In Progress', 'Resolved', 'Closed'];
  const counts = statuses.map(s => complaintsData.filter(c => c.status === s).length);
  const colors = ['#f59e0b', '#0ea5e9', '#10b981', '#64748b'];

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const maxVal = Math.max(...counts, 4);
  const barWidth = 40;
  const gap = 25;
  const startX = 40;
  const chartHeight = canvas.height - 60;

  statuses.forEach((status, i) => {
    const val = counts[i];
    const barH = (val / maxVal) * chartHeight;
    const x = startX + i * (barWidth + gap);
    const y = canvas.height - 35 - barH;

    ctx.fillStyle = colors[i];
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, barWidth, barH, [6, 6, 0, 0]);
    } else {
      ctx.rect(x, y, barWidth, barH);
    }
    ctx.fill();

    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-main').trim() || '#ffffff';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(val.toString(), x + barWidth / 2, y - 6);

    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#94a3b8';
    ctx.font = '500 11px Inter, sans-serif';
    ctx.fillText(status, x + barWidth / 2, canvas.height - 12);
  });
}

// Notification Drawer Modal
function toggleNotificationsModal() {
  const modal = document.getElementById('modal-notifications');
  const list = document.getElementById('notifications-list');
  const badge = document.getElementById('unread-count');

  if (badge) badge.innerText = '0';

  let relevantComplaints = complaintsData;
  if (currentUser && currentUser.role === 'student') {
    relevantComplaints = complaintsData.filter(c => isComplaintOwnedByStudent(c, currentUser));
  } else if (currentUser && currentUser.role === 'authority') {
    relevantComplaints = complaintsData.filter(c => currentUser.department === 'ALL' || !currentUser.department || c.department === currentUser.department);
  }

  const recent = relevantComplaints.slice(0, 8);

  if (!recent || recent.length === 0) {
    list.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-dark); font-style: italic;">No recent updates found.</p>';
  } else {
    list.innerHTML = recent.map(c => {
      const isResolved = c.status === 'Resolved';
      return `
        <div onclick="openDetailFromNotification('${c.ticketId || c.id}')" style="background: ${isResolved ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-card)'}; padding: 0.85rem; border-radius: var(--radius-md); border-left: 4px solid ${isResolved ? '#10b981' : 'var(--primary)'}; font-size: 0.85rem; cursor: pointer; transition: transform 0.2s ease; margin-bottom: 0.6rem;">
          <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 0.2rem;">
            <span class="ticket-id">${c.ticketId || c.id}</span>
            <span style="font-size: 0.75rem; color: var(--text-dark);">${c.createdAtStr || c.createdAt}</span>
          </div>
          <p style="color: var(--text-main); font-weight: 600; margin-bottom: 0.25rem;">${escapeHtml(c.title)}</p>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem;">
            <span style="color: var(--text-muted);">${getDeptLabel(c.department)}</span>
            ${isResolved ? '<span style="color: #10b981; font-weight: 700; font-size: 0.75rem;"><i class="fa-solid fa-circle-check"></i> Problem Solved</span>' : `<span class="badge ${getStatusBadgeClass(c.status)}">${c.status}</span>`}
          </div>
        </div>
      `;
    }).join('');
  }

  modal.classList.add('active');
}

function openDetailFromNotification(id) {
  closeModal('modal-notifications');
  openDetailModal(id);
}

function updateNotificationBadge() {
  const badge = document.getElementById('unread-count');
  if (!badge) return;

  if (currentUser && currentUser.role === 'student') {
    const myCount = complaintsData.filter(c => isComplaintOwnedByStudent(c, currentUser)).length;
    badge.innerText = myCount.toString();
  } else if (currentUser && currentUser.role === 'authority') {
    const deptCount = complaintsData.filter(c => c.department === currentUser.department).length;
    badge.innerText = deptCount.toString();
  } else {
    badge.innerText = complaintsData.length.toString();
  }
}

// Modal Helpers
function openNewComplaintModal() {
  if (currentUser && currentUser.role !== 'student') {
    showToast('Complaint submission is restricted to students only.', 'error');
    return;
  }
  if (currentUser) {
    const nameInput = document.getElementById('comp-student-name');
    if (nameInput) nameInput.value = currentUser.name;
  }
  document.getElementById('modal-new-complaint').classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove('active');
}

function printOfficialReport() {
  window.print();
}

// Theme Management (Light Mode by Default)
function initTheme() {
  const savedTheme = localStorage.getItem('scms_theme') || 'light';
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('scms_theme', theme);

  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.innerHTML = theme === 'dark' 
      ? '<i class="fa-solid fa-sun" style="color: #f59e0b;"></i>' 
      : '<i class="fa-solid fa-moon"></i>';
    btn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  }

  if (typeof renderCharts === 'function') {
    renderCharts();
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

function showLoader(msg = 'Processing request...') {
  const loader = document.getElementById('global-loader');
  const text = document.getElementById('loader-text');
  if (text) text.innerText = msg;
  if (loader) loader.style.display = 'flex';
}

function hideLoader() {
  const loader = document.getElementById('global-loader');
  if (loader) loader.style.display = 'none';
}

function renderAllViews() {
  renderComplaints();
  renderAuthorityView();
  renderAdminView();
}

function getDeptLabel(code) {
  const map = {
    'IT': 'Information Technology',
    'COMP': 'Computer Engineering',
    'INFRA': 'Infrastructure & Maintenance',
    'TRANS': 'Transportation Authority',
    'EXAM': 'Exam Cell',
    'HOSTEL': 'Hostel Management'
  };
  return map[code] || code;
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'Pending': return 'badge-pending';
    case 'In Progress': return 'badge-in-progress';
    case 'Resolved': return 'badge-resolved';
    case 'Closed': return 'badge-closed';
    default: return 'badge-pending';
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'Pending': return 'fa-solid fa-clock';
    case 'In Progress': return 'fa-solid fa-spinner fa-spin';
    case 'Resolved': return 'fa-solid fa-circle-check';
    case 'Closed': return 'fa-solid fa-lock';
    default: return 'fa-solid fa-circle';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';

  let icon = 'fa-solid fa-circle-info';
  if (type === 'success') icon = 'fa-solid fa-circle-check';
  if (type === 'error') icon = 'fa-solid fa-triangle-exclamation';

  toast.innerHTML = `
    <i class="${icon}" style="color: var(--primary); font-size: 1.2rem;"></i>
    <span style="font-size: 0.88rem; font-weight: 500;">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}

// Responsive UI Debounce Helper
function debounce(fn, delay = 220) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

const debouncedRenderComplaints = debounce(() => {
  currentStudentPage = 1;
  renderComplaints();
}, 200);

const debouncedRenderAdminTable = debounce(() => renderAdminTable(), 200);
const debouncedRenderAdminUsers = debounce(() => renderAdminUsers(), 200);

function setupEventListeners() {
  window.addEventListener('resize', () => {
    if (currentTab === 'admin' && currentAdminSubtab === 'analytics') {
      renderCharts();
    }
  });

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debouncedRenderComplaints);
  }

  const adminSearch = document.getElementById('admin-search-input');
  if (adminSearch) {
    adminSearch.addEventListener('input', debouncedRenderAdminTable);
  }

  const userSearch = document.getElementById('user-search-input');
  if (userSearch) {
    userSearch.addEventListener('input', debouncedRenderAdminUsers);
  }
}
