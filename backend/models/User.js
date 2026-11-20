const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    customId: {
      type: String,
      default: () => `USR-${Math.floor(100 + Math.random() * 900)}`,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Please provide full name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide email'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    rollNo: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    department: {
      type: String,
      default: 'IT',
      index: true,
    },
    role: {
      type: String,
      enum: ['student', 'authority', 'admin'],
      default: 'student',
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Please provide password'],
      minlength: 4,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    academicYear: {
      type: String,
      default: 'TE (Third Year)',
      trim: true,
    },
    division: {
      type: String,
      default: 'A',
      trim: true,
    },
    guardianName: {
      type: String,
      default: '',
      trim: true,
    },
    guardianPhone: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    batchYear: {
      type: String,
      default: '2023 - 2027',
      trim: true,
    },
    avatar: {
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

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password helper
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (this.password === candidatePassword) {
    return true;
  }
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (err) {
    return false;
  }
};

module.exports = mongoose.model('User', userSchema);
