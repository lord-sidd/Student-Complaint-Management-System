const jwt = require('jsonwebtoken');
const User = require('../models/User');
const storageService = require('../services/storageService');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'scms_super_secret_jwt_key_2026'
      );

      if (storageService.isMongoOnline()) {
        req.user = await User.findById(decoded.id).select('-password');
      } else {
        const found = storageService.findUser(u => u._id === decoded.id || u.customId === decoded.id || u.id === decoded.id);
        if (found) {
          const { password, ...safe } = found;
          req.user = safe;
        }
      }

      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }
      return next();
    } catch (error) {
      console.error('Auth token verification error:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

// Optional protect middleware: sets req.user if valid token provided, but doesn't block if absent
const optionalProtect = async (req, res, next) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'scms_super_secret_jwt_key_2026'
      );

      if (storageService.isMongoOnline()) {
        req.user = await User.findById(decoded.id).select('-password');
      } else {
        const found = storageService.findUser(u => u._id === decoded.id || u.customId === decoded.id || u.id === decoded.id);
        if (found) {
          const { password, ...safe } = found;
          req.user = safe;
        }
      }
    } catch (err) {
      // Continue as unauthenticated guest
    }
  }
  next();
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role '${req.user ? req.user.role : 'guest'}' is not authorized to access this route`,
      });
    }
    next();
  };
};

module.exports = { protect, optionalProtect, authorize };
