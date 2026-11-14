const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    headOfficer: {
      type: String,
      default: 'Department Head',
    },
    email: {
      type: String,
      default: '',
    },
    slaTargetHours: {
      type: Number,
      default: 72,
    },
    description: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Department', departmentSchema);

