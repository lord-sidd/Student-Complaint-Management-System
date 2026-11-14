const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      default: '',
      index: true,
    },
    action: {
      type: String,
      required: true,
    },
    performedBy: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: 'system',
    },
    details: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);

