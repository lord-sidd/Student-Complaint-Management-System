const Complaint = require('../models/Complaint');
const AuditLog = require('../models/AuditLog');
const { analyzeComplaint } = require('../utils/aiService');
const { notifyComplaintCreated, notifyComplaintUpdated } = require('../utils/emailService');
const storageService = require('../services/storageService');

// Helper: Check and auto-update overdue status on complaints
const checkAndApplySla = async (complaints) => {
  const now = new Date();
  for (const c of complaints) {
    if (c.status !== 'Resolved' && c.status !== 'Closed') {
      if (c.slaDeadline && now > new Date(c.slaDeadline) && !c.isOverdue) {
        c.isOverdue = true;
        // If overdue by more than 24h, escalate to High priority
        const hoursPast = (now - new Date(c.slaDeadline)) / (1000 * 3600);
        if (hoursPast >= 24 && !c.escalated) {
          c.escalated = true;
          c.priority = 'High';
          if (c.timeline) {
            c.timeline.push({
              step: 'SLA Escalation Alert',
              date: now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              desc: 'Complaint automatically escalated due to SLA resolution deadline breach.',
              author: 'SLA Watchdog',
            });
          }
        }
        if (c.save) await c.save().catch(() => {});
      }
    }
  }
};

// @desc    Get all complaints with search, filters, and pagination
// @route   GET /api/complaints
const getComplaints = async (req, res) => {
  try {
    const {
      department,
      status,
      priority,
      search,
      isOverdue,
      student,
      studentEmail,
      studentRollNo,
      userId,
      page = 1,
      limit = 50,
    } = req.query;

    if (storageService.isMongoOnline()) {
      let query = {};

      if (req.user) {
        if (req.user.role === 'student') {
          query.$or = [
            { userId: req.user.customId || req.user._id.toString() },
            { studentEmail: req.user.email.toLowerCase() },
            { studentRollNo: req.user.rollNo },
            { studentName: { $regex: req.user.name, $options: 'i' } },
          ];
        } else if (req.user.role === 'authority') {
          query.department = req.user.department;
        }
      } else {
        if (userId) {
          query.userId = userId;
        } else if (studentEmail) {
          query.studentEmail = studentEmail.toLowerCase();
        } else if (studentRollNo) {
          query.$or = [
            { studentRollNo: studentRollNo },
            { studentName: { $regex: studentRollNo, $options: 'i' } },
          ];
        } else if (student) {
          query.studentName = { $regex: student, $options: 'i' };
        }
      }

      if (department && department !== 'ALL' && (!req.user || req.user.role === 'admin')) {
        query.department = department;
      }

      if (status && status !== 'ALL') {
        query.status = status;
      }

      if (priority && priority !== 'ALL') {
        query.priority = priority;
      }

      if (isOverdue === 'true' || isOverdue === true) {
        query.isOverdue = true;
      }

      if (search && search.trim() !== '') {
        const s = search.trim();
        const searchConditions = [
          { title: { $regex: s, $options: 'i' } },
          { description: { $regex: s, $options: 'i' } },
          { ticketId: { $regex: s, $options: 'i' } },
          { studentName: { $regex: s, $options: 'i' } },
          { category: { $regex: s, $options: 'i' } },
        ];
        if (query.$or) {
          query = { $and: [{ $or: query.$or }, { $or: searchConditions }] };
        } else {
          query.$or = searchConditions;
        }
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const totalCount = await Complaint.countDocuments(query);
      const complaints = await Complaint.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      checkAndApplySla(complaints);

      const formatted = complaints.map((c) => ({
        id: c.ticketId,
        _id: c._id,
        ticketId: c.ticketId,
        title: c.title,
        department: c.department,
        category: c.category,
        priority: c.priority,
        studentName: c.studentName,
        studentEmail: c.studentEmail,
        studentRollNo: c.studentRollNo,
        userId: c.userId,
        description: c.description,
        attachment: c.attachment,
        status: c.status,
        createdAt: c.createdAtStr,
        createdAtStr: c.createdAtStr,
        slaDeadline: c.slaDeadline,
        isOverdue: c.isOverdue,
        escalated: c.escalated,
        assignedTo: c.assignedTo,
        feedback: c.feedback,
        aiCategory: c.aiCategory,
        timeline: c.timeline,
        remarks: c.remarks,
      }));

      return res.json({
        success: true,
        count: formatted.length,
        total: totalCount,
        page: parseInt(page),
        pages: Math.ceil(totalCount / parseInt(limit)) || 1,
        data: formatted,
      });
    }

    // Storage Service Local Fallback
    let allComplaints = storageService.getComplaints({ department, status, priority, isOverdue, search });

    // Scoping
    if (req.user) {
      if (req.user.role === 'student') {
        const sEmail = (req.user.email || '').toLowerCase();
        const sRoll = (req.user.rollNo || '').toLowerCase();
        const sName = (req.user.name || '').toLowerCase();
        const sId = req.user.customId || req.user._id || req.user.id;
        allComplaints = allComplaints.filter(c =>
          (c.userId && c.userId === sId) ||
          (c.studentEmail && c.studentEmail.toLowerCase() === sEmail) ||
          (c.studentRollNo && c.studentRollNo.toLowerCase() === sRoll) ||
          (c.studentName && c.studentName.toLowerCase().includes(sName))
        );
      } else if (req.user.role === 'authority') {
        allComplaints = allComplaints.filter(c => c.department === req.user.department);
      }
    } else {
      if (studentEmail) {
        allComplaints = allComplaints.filter(c => (c.studentEmail || '').toLowerCase() === studentEmail.toLowerCase());
      } else if (studentRollNo) {
        allComplaints = allComplaints.filter(c => (c.studentRollNo || '').toLowerCase() === studentRollNo.toLowerCase());
      } else if (userId) {
        allComplaints = allComplaints.filter(c => c.userId === userId);
      }
    }

    const totalCount = allComplaints.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginated = allComplaints.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      count: paginated.length,
      total: totalCount,
      page: parseInt(page),
      pages: Math.ceil(totalCount / parseInt(limit)) || 1,
      data: paginated,
    });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single complaint by ticket ID
// @route   GET /api/complaints/:id
const getComplaintById = async (req, res) => {
  try {
    const ticketId = req.params.id;

    if (storageService.isMongoOnline()) {
      const complaint = await Complaint.findOne({
        $or: [{ ticketId: ticketId }, { _id: ticketId.match(/^[0-9a-fA-F]{24}$/) ? ticketId : null }],
      });

      if (!complaint) {
        return res.status(404).json({ message: 'Complaint ticket not found' });
      }

      return res.json({
        success: true,
        data: {
          id: complaint.ticketId,
          _id: complaint._id,
          title: complaint.title,
          department: complaint.department,
          category: complaint.category,
          priority: complaint.priority,
          studentName: complaint.studentName,
          studentEmail: complaint.studentEmail,
          studentRollNo: complaint.studentRollNo,
          userId: complaint.userId,
          description: complaint.description,
          attachment: complaint.attachment,
          status: complaint.status,
          createdAt: complaint.createdAtStr,
          slaDeadline: complaint.slaDeadline,
          isOverdue: complaint.isOverdue,
          escalated: complaint.escalated,
          assignedTo: complaint.assignedTo,
          feedback: complaint.feedback,
          aiCategory: complaint.aiCategory,
          timeline: complaint.timeline,
          remarks: complaint.remarks,
        },
      });
    }

    const localComplaint = storageService.findComplaint(ticketId);
    if (!localComplaint) {
      return res.status(404).json({ message: 'Complaint ticket not found' });
    }

    res.json({ success: true, data: localComplaint });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new complaint
// @route   POST /api/complaints
const createComplaint = async (req, res) => {
  try {
    const {
      title,
      department,
      category,
      priority,
      studentName,
      studentEmail,
      studentRollNo,
      userId,
      description,
      attachment,
    } = req.body;

    if (!title || !description || !department) {
      return res.status(400).json({ message: 'Title, description and department are required' });
    }

    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newTicketId = `CMP-${year}-${randomSuffix}`;

    const now = new Date();
    const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const chosenPriority = priority || 'Medium';
    const hours = chosenPriority === 'High' ? 48 : chosenPriority === 'Medium' ? 72 : 120;
    const slaDeadline = new Date(now.getTime() + hours * 3600 * 1000);

    const aiAnalysis = analyzeComplaint(title, description);

    let complaintData = null;

    if (storageService.isMongoOnline()) {
      const complaint = await Complaint.create({
        ticketId: newTicketId,
        title: title.trim(),
        department,
        category: category || aiAnalysis.category || 'Infrastructure',
        priority: chosenPriority,
        studentName: studentName || req.user?.name || 'Student User',
        studentEmail: (studentEmail || req.user?.email || '').toLowerCase(),
        studentRollNo: studentRollNo || req.user?.rollNo || '',
        userId: userId || req.user?.customId || (req.user?._id ? req.user._id.toString() : null),
        description: description.trim(),
        attachment: attachment || null,
        status: 'Pending',
        createdAtStr: dateStr,
        slaDeadline,
        isOverdue: false,
        escalated: false,
        aiCategory: {
          suggestedDept: aiAnalysis.department,
          suggestedCategory: aiAnalysis.category,
          suggestedPriority: aiAnalysis.priority,
          confidence: aiAnalysis.confidence,
          explanation: aiAnalysis.explanation,
        },
        timeline: [
          {
            step: 'Complaint Submitted',
            date: dateStr,
            desc: 'Lodged by student via SCMS Portal.',
            author: studentName || 'Student',
          },
        ],
        remarks: [],
      });

      await AuditLog.create({
        ticketId: complaint.ticketId,
        action: 'COMPLAINT_CREATED',
        performedBy: complaint.studentName,
        role: 'student',
        details: `Created grievance ticket in ${complaint.department} department (${complaint.priority} priority)`,
      }).catch(() => {});

      complaintData = {
        id: complaint.ticketId,
        _id: complaint._id,
        ticketId: complaint.ticketId,
        title: complaint.title,
        department: complaint.department,
        category: complaint.category,
        priority: complaint.priority,
        studentName: complaint.studentName,
        studentEmail: complaint.studentEmail,
        studentRollNo: complaint.studentRollNo,
        userId: complaint.userId,
        description: complaint.description,
        attachment: complaint.attachment,
        status: complaint.status,
        createdAt: complaint.createdAtStr,
        createdAtStr: complaint.createdAtStr,
        slaDeadline: complaint.slaDeadline,
        isOverdue: complaint.isOverdue,
        timeline: complaint.timeline,
        remarks: complaint.remarks,
        aiCategory: complaint.aiCategory,
      };
    } else {
      complaintData = storageService.createComplaint({
        ticketId: newTicketId,
        title: title.trim(),
        department,
        category: category || aiAnalysis.category || 'Infrastructure',
        priority: chosenPriority,
        studentName: studentName || req.user?.name || 'Student User',
        studentEmail: (studentEmail || req.user?.email || '').toLowerCase(),
        studentRollNo: studentRollNo || req.user?.rollNo || '',
        userId: userId || req.user?.customId || req.user?.id || null,
        description: description.trim(),
        attachment: attachment || null,
        aiCategory: {
          suggestedDept: aiAnalysis.department,
          suggestedCategory: aiAnalysis.category,
          suggestedPriority: aiAnalysis.priority,
          confidence: aiAnalysis.confidence,
          explanation: aiAnalysis.explanation,
        },
      });

      storageService.logAudit(
        'COMPLAINT_CREATED',
        complaintData.studentName,
        'student',
        `Created ticket ${complaintData.ticketId} in ${complaintData.department}`,
        complaintData.ticketId
      );
    }

    notifyComplaintCreated(complaintData).catch((err) => console.warn('Email notify error:', err.message));

    const io = req.app.get('io');
    if (io) {
      io.emit('complaint:created', complaintData);
      io.to(`dept_${complaintData.department}`).emit('notification', {
        title: 'New Complaint Registered',
        message: `Ticket ${complaintData.ticketId}: ${complaintData.title} (${complaintData.priority} Priority)`,
        ticketId: complaintData.ticketId,
        type: 'new_ticket',
      });
    }

    res.status(201).json({
      success: true,
      message: `Grievance registered successfully with ID ${complaintData.id || complaintData.ticketId}`,
      data: complaintData,
    });
  } catch (error) {
    console.error('Create complaint error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update complaint status, priority, re-route department, or add official remarks
// @route   PUT /api/complaints/:id
const updateComplaint = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { status, department, priority, remarkText, officerName } = req.body;
    const now = new Date();
    const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const actor = officerName || req.user?.name || 'Department Officer';

    if (storageService.isMongoOnline()) {
      const complaint = await Complaint.findOne({
        $or: [{ ticketId: ticketId }, { _id: ticketId.match(/^[0-9a-fA-F]{24}$/) ? ticketId : null }],
      });

      if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

      if (req.user && req.user.role === 'authority' && complaint.department !== req.user.department) {
        return res.status(403).json({ message: 'Unauthorized: Ticket assigned to another department' });
      }

      if (status && status !== complaint.status) {
        const prev = complaint.status;
        complaint.status = status;
        complaint.timeline.push({
          step: `Status: ${status}`,
          date: dateStr,
          desc: `Status changed from '${prev}' to '${status}' by ${actor}.`,
          author: actor,
        });
        if (status === 'Resolved' || status === 'Closed') complaint.isOverdue = false;
      }

      if (department && department !== complaint.department) {
        const prev = complaint.department;
        complaint.department = department;
        complaint.timeline.push({
          step: `Re-routed to ${department}`,
          date: dateStr,
          desc: `Re-assigned from ${prev} to ${department} by ${actor}.`,
          author: actor,
        });
      }

      if (priority && priority !== complaint.priority) {
        const prev = complaint.priority;
        complaint.priority = priority;
        complaint.timeline.push({
          step: `Priority: ${priority}`,
          date: dateStr,
          desc: `Priority updated from ${prev} to ${priority} by ${actor}.`,
          author: actor,
        });
      }

      if (remarkText && remarkText.trim() !== '') {
        complaint.remarks.push({
          author: `${actor} (${complaint.department})`,
          date: dateStr,
          text: remarkText.trim(),
        });
        complaint.timeline.push({
          step: 'Official Remark Added',
          date: dateStr,
          desc: remarkText.trim(),
          author: actor,
        });
      }

      await complaint.save();

      const fullComplaintData = {
        id: complaint.ticketId,
        _id: complaint._id,
        ticketId: complaint.ticketId,
        title: complaint.title,
        department: complaint.department,
        category: complaint.category,
        priority: complaint.priority,
        studentName: complaint.studentName,
        studentEmail: complaint.studentEmail,
        studentRollNo: complaint.studentRollNo,
        userId: complaint.userId,
        attachment: complaint.attachment,
        description: complaint.description,
        status: complaint.status,
        createdAt: complaint.createdAtStr,
        createdAtStr: complaint.createdAtStr,
        slaDeadline: complaint.slaDeadline,
        isOverdue: complaint.isOverdue,
        assignedTo: complaint.assignedTo,
        feedback: complaint.feedback,
        timeline: complaint.timeline,
        remarks: complaint.remarks,
        aiCategory: complaint.aiCategory,
      };

      notifyComplaintUpdated(fullComplaintData, { remarkText }).catch(() => {});

      const io = req.app.get('io');
      if (io) {
        io.emit('complaint:updated', fullComplaintData);

        const targetUserRooms = [];
        if (complaint.userId) targetUserRooms.push(`user_${complaint.userId}`);
        if (complaint.studentEmail) targetUserRooms.push(`user_${complaint.studentEmail.toLowerCase()}`);

        const notifTitle = complaint.status === 'Resolved'
          ? '🎉 Problem Solved & Grievance Resolved!'
          : `⚡ Grievance ${complaint.ticketId} Updated`;

        const notifMsg = complaint.status === 'Resolved'
          ? `Your grievance ${complaint.ticketId} has been resolved by ${actor}. Remarks: "${remarkText || 'Issue resolved.'}". You can now provide feedback!`
          : `Ticket ${complaint.ticketId} (${complaint.department}) status changed to '${complaint.status}'${remarkText ? ': "' + remarkText + '"' : '.'}`;

        const notifPayload = {
          title: notifTitle,
          message: notifMsg,
          ticketId: complaint.ticketId,
          status: complaint.status,
          department: complaint.department,
          targetUserId: complaint.userId,
          targetEmail: (complaint.studentEmail || '').toLowerCase(),
          type: complaint.status === 'Resolved' ? 'resolved' : 'update',
          timestamp: dateStr,
        };

        targetUserRooms.forEach((r) => io.to(r).emit('notification', notifPayload));
        io.emit('notification', notifPayload);
      }

      return res.json({
        success: true,
        message: 'Complaint updated successfully',
        data: fullComplaintData,
      });
    }

    // Local Storage Fallback
    const local = storageService.findComplaint(ticketId);
    if (!local) return res.status(404).json({ message: 'Complaint not found' });

    const updates = {};
    const timeline = [...(local.timeline || [])];
    const remarks = [...(local.remarks || [])];

    if (status && status !== local.status) {
      updates.status = status;
      timeline.push({
        step: `Status: ${status}`,
        date: dateStr,
        desc: `Status changed from '${local.status}' to '${status}' by ${actor}.`,
        author: actor,
      });
      if (status === 'Resolved' || status === 'Closed') updates.isOverdue = false;
    }

    if (department && department !== local.department) {
      updates.department = department;
      timeline.push({
        step: `Re-routed to ${department}`,
        date: dateStr,
        desc: `Re-assigned from ${local.department} to ${department} by ${actor}.`,
        author: actor,
      });
    }

    if (priority && priority !== local.priority) {
      updates.priority = priority;
      timeline.push({
        step: `Priority: ${priority}`,
        date: dateStr,
        desc: `Priority updated from ${local.priority} to ${priority} by ${actor}.`,
        author: actor,
      });
    }

    if (remarkText && remarkText.trim() !== '') {
      remarks.push({
        author: `${actor} (${updates.department || local.department})`,
        date: dateStr,
        text: remarkText.trim(),
      });
      timeline.push({
        step: 'Official Remark Added',
        date: dateStr,
        desc: remarkText.trim(),
        author: actor,
      });
    }

    updates.timeline = timeline;
    updates.remarks = remarks;

    const updated = storageService.updateComplaint(ticketId, updates);

    notifyComplaintUpdated(updated, { remarkText }).catch(() => {});

    const io = req.app.get('io');
    if (io) {
      io.emit('complaint:updated', updated);

      const targetUserRooms = [];
      if (updated.userId) targetUserRooms.push(`user_${updated.userId}`);
      if (updated.studentEmail) targetUserRooms.push(`user_${updated.studentEmail.toLowerCase()}`);

      const notifTitle = updated.status === 'Resolved'
        ? '🎉 Problem Solved & Grievance Resolved!'
        : `⚡ Grievance ${updated.ticketId || updated.id} Updated`;

      const notifMsg = updated.status === 'Resolved'
        ? `Your grievance ${updated.ticketId || updated.id} has been resolved by ${actor}. Remarks: "${remarkText || 'Issue resolved.'}". You can now provide feedback!`
        : `Ticket ${updated.ticketId || updated.id} (${updated.department}) status changed to '${updated.status}'${remarkText ? ': "' + remarkText + '"' : '.'}`;

      const notifPayload = {
        title: notifTitle,
        message: notifMsg,
        ticketId: updated.ticketId || updated.id,
        status: updated.status,
        department: updated.department,
        targetUserId: updated.userId,
        targetEmail: (updated.studentEmail || '').toLowerCase(),
        type: updated.status === 'Resolved' ? 'resolved' : 'update',
        timestamp: dateStr,
      };

      targetUserRooms.forEach((r) => io.to(r).emit('notification', notifPayload));
      io.emit('notification', notifPayload);
    }

    res.json({
      success: true,
      message: 'Complaint updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Update complaint error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign complaint to officer
// @route   PUT /api/complaints/:id/assign
const assignComplaint = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { officerName, officerEmail, officerRole } = req.body;

    if (!officerName) {
      return res.status(400).json({ message: 'Officer name is required' });
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const assignedTo = {
      name: officerName.trim(),
      email: officerEmail ? officerEmail.trim() : '',
      role: officerRole || 'Investigating Officer',
      assignedAt: now.toISOString(),
    };

    if (storageService.isMongoOnline()) {
      const complaint = await Complaint.findOne({
        $or: [{ ticketId: ticketId }, { _id: ticketId.match(/^[0-9a-fA-F]{24}$/) ? ticketId : null }],
      });

      if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

      complaint.assignedTo = assignedTo;
      complaint.timeline.push({
        step: 'Assigned to Officer',
        date: dateStr,
        desc: `Ticket assigned to ${officerName} (${officerRole || 'Officer'}) for active investigation.`,
        author: req.user?.name || 'Authority',
      });

      if (complaint.status === 'Pending') complaint.status = 'In Progress';
      await complaint.save();

      notifyComplaintUpdated(complaint, {
        remarkText: `Ticket assigned to investigating officer: ${officerName} (${officerRole || 'Officer'}).`
      }).catch(() => {});

      const io = req.app.get('io');
      if (io) {
        io.emit('complaint:updated', complaint);

        const targetUserRooms = [];
        if (complaint.userId) targetUserRooms.push(`user_${complaint.userId}`);
        if (complaint.studentEmail) targetUserRooms.push(`user_${complaint.studentEmail.toLowerCase()}`);

        const notifPayload = {
          title: '👨‍💼 Officer Assigned',
          message: `Your grievance ${complaint.ticketId} has been assigned to ${officerName} (${officerRole || 'Officer'}) for investigation.`,
          ticketId: complaint.ticketId,
          status: complaint.status,
          department: complaint.department,
          targetUserId: complaint.userId,
          targetEmail: (complaint.studentEmail || '').toLowerCase(),
          type: 'assigned',
          timestamp: dateStr,
        };

        targetUserRooms.forEach((r) => io.to(r).emit('notification', notifPayload));
        io.emit('notification', notifPayload);
      }

      return res.json({
        success: true,
        message: `Ticket successfully assigned to ${officerName}`,
        data: complaint,
      });
    }

    const local = storageService.findComplaint(ticketId);
    if (!local) return res.status(404).json({ message: 'Complaint not found' });

    const timeline = [...(local.timeline || [])];
    timeline.push({
      step: 'Assigned to Officer',
      date: dateStr,
      desc: `Ticket assigned to ${officerName} (${officerRole || 'Officer'}) for active investigation.`,
      author: req.user?.name || 'Authority',
    });

    const updated = storageService.updateComplaint(ticketId, {
      assignedTo,
      status: local.status === 'Pending' ? 'In Progress' : local.status,
      timeline,
    });

    notifyComplaintUpdated(updated, {
      remarkText: `Ticket assigned to investigating officer: ${officerName} (${officerRole || 'Officer'}).`
    }).catch(() => {});

    const io = req.app.get('io');
    if (io) {
      io.emit('complaint:updated', updated);

      const targetUserRooms = [];
      if (updated.userId) targetUserRooms.push(`user_${updated.userId}`);
      if (updated.studentEmail) targetUserRooms.push(`user_${updated.studentEmail.toLowerCase()}`);

      const notifPayload = {
        title: '👨‍💼 Officer Assigned',
        message: `Your grievance ${updated.ticketId || updated.id} has been assigned to ${officerName} (${officerRole || 'Officer'}) for investigation.`,
        ticketId: updated.ticketId || updated.id,
        status: updated.status,
        department: updated.department,
        targetUserId: updated.userId,
        targetEmail: (updated.studentEmail || '').toLowerCase(),
        type: 'assigned',
        timestamp: dateStr,
      };

      targetUserRooms.forEach((r) => io.to(r).emit('notification', notifPayload));
      io.emit('notification', notifPayload);
    }

    res.json({
      success: true,
      message: `Ticket successfully assigned to ${officerName}`,
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Submit student resolution feedback & rating
// @route   POST /api/complaints/:id/feedback
const submitFeedback = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { rating, comment, studentName } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Valid rating between 1 and 5 is required' });
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const feedback = {
      rating: parseInt(rating),
      comment: comment ? comment.trim() : '',
      submittedAt: now.toISOString(),
      studentName: studentName || req.user?.name || 'Student',
    };

    if (storageService.isMongoOnline()) {
      const complaint = await Complaint.findOne({
        $or: [{ ticketId: ticketId }, { _id: ticketId.match(/^[0-9a-fA-F]{24}$/) ? ticketId : null }],
      });

      if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

      if (complaint.status !== 'Resolved' && complaint.status !== 'Closed') {
        return res.status(400).json({ message: 'Feedback can only be submitted for Resolved or Closed grievances' });
      }

      complaint.feedback = feedback;
      complaint.timeline.push({
        step: 'Resolution Feedback Submitted',
        date: dateStr,
        desc: `Student provided rating of ${rating}/5 stars. ${comment ? `"${comment.trim()}"` : ''}`,
        author: feedback.studentName,
      });

      await complaint.save();

      const io = req.app.get('io');
      if (io) {
        io.emit('complaint:updated', {
          id: complaint.ticketId,
          ticketId: complaint.ticketId,
          feedback: complaint.feedback,
        });
      }

      return res.json({
        success: true,
        message: 'Thank you! Your feedback has been recorded.',
        data: complaint.feedback,
      });
    }

    const local = storageService.findComplaint(ticketId);
    if (!local) return res.status(404).json({ message: 'Complaint not found' });

    if (local.status !== 'Resolved' && local.status !== 'Closed') {
      return res.status(400).json({ message: 'Feedback can only be submitted for Resolved or Closed grievances' });
    }

    const timeline = [...(local.timeline || [])];
    timeline.push({
      step: 'Resolution Feedback Submitted',
      date: dateStr,
      desc: `Student provided rating of ${rating}/5 stars. ${comment ? `"${comment.trim()}"` : ''}`,
      author: feedback.studentName,
    });

    const updated = storageService.updateComplaint(ticketId, { feedback, timeline });

    const io = req.app.get('io');
    if (io) {
      io.emit('complaint:updated', {
        id: updated.ticketId || updated.id,
        ticketId: updated.ticketId || updated.id,
        feedback: updated.feedback,
      });
    }

    res.json({
      success: true,
      message: 'Thank you! Your feedback has been recorded.',
      data: updated.feedback,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    AI Smart Categorization and Suggestion Endpoint
// @route   POST /api/complaints/ai-suggest
const aiSuggest = async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title && !description) {
      return res.status(400).json({ message: 'Please provide a title or description for AI analysis' });
    }

    const suggestion = analyzeComplaint(title, description);
    res.json({ success: true, suggestion });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Upload file attachment via Multer
// @route   POST /api/complaints/upload
const uploadAttachment = async (req, res) => {
  try {
    const file = req.file || (req.files && (req.files.file?.[0] || req.files.attachment?.[0]));
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${file.filename}`;
    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      url: fileUrl,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Export complaints as formatted CSV
// @route   GET /api/complaints/export/csv
const exportComplaintsCSV = async (req, res) => {
  try {
    let complaints = [];
    if (storageService.isMongoOnline()) {
      complaints = await Complaint.find().sort({ createdAt: -1 });
    } else {
      complaints = storageService.getComplaints();
    }

    const headers = [
      'Ticket ID',
      'Title',
      'Department',
      'Category',
      'Priority',
      'Status',
      'Student Name',
      'Student Email',
      'Roll No',
      'Assigned Officer',
      'SLA Status',
      'Submitted Date',
      'Feedback Rating',
      'Description',
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const clean = String(str).replace(/"/g, '""');
      return `"${clean}"`;
    };

    const rows = complaints.map((c) => [
      escapeCsv(c.ticketId || c.id),
      escapeCsv(c.title),
      escapeCsv(c.department),
      escapeCsv(c.category),
      escapeCsv(c.priority),
      escapeCsv(c.status),
      escapeCsv(c.studentName),
      escapeCsv(c.studentEmail),
      escapeCsv(c.studentRollNo),
      escapeCsv(c.assignedTo?.name || 'Unassigned'),
      escapeCsv(c.isOverdue ? 'OVERDUE' : 'Within SLA'),
      escapeCsv(c.createdAtStr || c.createdAt),
      escapeCsv(c.feedback?.rating ? `${c.feedback.rating}/5` : 'Pending Feedback'),
      escapeCsv(c.description),
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="SCMS_Complaints_Report_${Date.now()}.csv"`);
    res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get analytics and summary statistics
// @route   GET /api/complaints/analytics/stats
const getStats = async (req, res) => {
  try {
    if (storageService.isMongoOnline()) {
      const total = await Complaint.countDocuments();
      const pending = await Complaint.countDocuments({ status: 'Pending' });
      const progress = await Complaint.countDocuments({ status: 'In Progress' });
      const resolved = await Complaint.countDocuments({ status: { $in: ['Resolved', 'Closed'] } });
      const overdue = await Complaint.countDocuments({ isOverdue: true, status: { $in: ['Pending', 'In Progress'] } });

      const deptStats = await Complaint.aggregate([{ $group: { _id: '$department', count: { $sum: 1 } } }]);
      const statusStats = await Complaint.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);

      const ratingAggregation = await Complaint.aggregate([
        { $match: { 'feedback.rating': { $exists: true, $ne: null } } },
        { $group: { _id: null, avgRating: { $avg: '$feedback.rating' }, totalFeedbacks: { $sum: 1 } } },
      ]);

      const avgRating = ratingAggregation[0]?.avgRating ? Math.round(ratingAggregation[0].avgRating * 10) / 10 : 4.8;
      const totalFeedbacks = ratingAggregation[0]?.totalFeedbacks || 0;

      return res.json({
        success: true,
        stats: {
          total,
          pending,
          progress,
          resolved,
          overdue,
          avgRating,
          totalFeedbacks,
          resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 100,
          deptDistribution: deptStats,
          statusDistribution: statusStats,
        },
      });
    }

    const complaints = storageService.getComplaints();
    const total = complaints.length;
    const pending = complaints.filter(c => c.status === 'Pending').length;
    const progress = complaints.filter(c => c.status === 'In Progress').length;
    const resolved = complaints.filter(c => c.status === 'Resolved' || c.status === 'Closed').length;
    const overdue = complaints.filter(c => c.isOverdue).length;

    const deptMap = {};
    const statusMap = {};
    let ratingSum = 0;
    let ratingCount = 0;

    complaints.forEach(c => {
      deptMap[c.department] = (deptMap[c.department] || 0) + 1;
      statusMap[c.status] = (statusMap[c.status] || 0) + 1;
      if (c.feedback && c.feedback.rating) {
        ratingSum += c.feedback.rating;
        ratingCount++;
      }
    });

    const deptDistribution = Object.keys(deptMap).map(d => ({ _id: d, count: deptMap[d] }));
    const statusDistribution = Object.keys(statusMap).map(s => ({ _id: s, count: statusMap[s] }));
    const avgRating = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 4.8;

    res.json({
      success: true,
      stats: {
        total,
        pending,
        progress,
        resolved,
        overdue,
        avgRating,
        totalFeedbacks: ratingCount,
        resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 100,
        deptDistribution,
        statusDistribution,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getComplaints,
  getComplaintById,
  createComplaint,
  updateComplaint,
  assignComplaint,
  submitFeedback,
  aiSuggest,
  uploadAttachment,
  exportComplaintsCSV,
  getStats,
};
