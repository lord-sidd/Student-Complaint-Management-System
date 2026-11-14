const mongoose = require('mongoose');

const timelineItemSchema = new mongoose.Schema(
  {
    step: { type: String, required: true },
    date: { type: String, required: true },
    desc: { type: String, default: '' },
    author: { type: String, default: 'System' },
  },
  { _id: false }
);

const remarkItemSchema = new mongoose.Schema(
  {
    author: { type: String, required: true },
    date: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const feedbackSchema = new mongoose.Schema(
  {
    rating: { type: Number, min: 1, max: 5, default: 5 },
    comment: { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },
    studentName: { type: String, default: '' },
  },
  { _id: false }
);

const assignedToSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    role: { type: String, default: 'Officer' },
    assignedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const aiCategorySchema = new mongoose.Schema(
  {
    suggestedDept: { type: String, default: '' },
    suggestedCategory: { type: String, default: '' },
    suggestedPriority: { type: String, default: '' },
    confidence: { type: Number, default: 0 },
    explanation: { type: String, default: '' },
  },
  { _id: false }
);

const complaintSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide complaint title'],
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Please select department'],
      enum: ['IT', 'COMP', 'INFRA', 'TRANS', 'EXAM', 'HOSTEL', 'ALL'],
      default: 'IT',
      index: true,
    },
    category: {
      type: String,
      default: 'Infrastructure',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
      index: true,
    },
    studentName: {
      type: String,
      required: true,
    },
    studentEmail: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
      index: true,
    },
    studentRollNo: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    userId: {
      type: String,
      default: null,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide description'],
    },
    attachment: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Resolved', 'Closed'],
      default: 'Pending',
      index: true,
    },
    createdAtStr: {
      type: String,
      default: () => {
        const now = new Date();
        return now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      },
    },
    timeline: [timelineItemSchema],
    remarks: [remarkItemSchema],
    assignedTo: {
      type: assignedToSchema,
      default: null,
    },
    slaDeadline: {
      type: Date,
      index: true,
    },
    isOverdue: {
      type: Boolean,
      default: false,
      index: true,
    },
    escalated: {
      type: Boolean,
      default: false,
    },
    feedback: {
      type: feedbackSchema,
      default: null,
    },
    aiCategory: {
      type: aiCategorySchema,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: auto-compute SLA deadline based on priority if not already set
complaintSchema.pre('save', function (next) {
  if (!this.slaDeadline) {
    const hours = this.priority === 'High' ? 48 : this.priority === 'Medium' ? 72 : 120;
    this.slaDeadline = new Date(Date.now() + hours * 3600 * 1000);
  }
  // Check overdue flag
  if (this.status !== 'Resolved' && this.status !== 'Closed') {
    if (this.slaDeadline && new Date() > this.slaDeadline) {
      this.isOverdue = true;
    }
  } else {
    this.isOverdue = false;
  }
  next();
});

module.exports = mongoose.model('Complaint', complaintSchema);
