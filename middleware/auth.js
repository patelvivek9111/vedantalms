const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { extractTokenFromRequest } = require('../utils/authCookie');

// Protect routes
exports.protect = async (req, res, next) => {
  const token = extractTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route',
      });
    }

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Your account has been suspended. Please contact an administrator.',
      });
    }

    const tokenVersion = decoded.tv ?? 0;
    if (tokenVersion !== (user.tokenVersion || 0)) {
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please sign in again.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route',
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    const allowedRoles = roles.flat();

    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this route',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role ${req.user.role} is not authorized to access this route`,
      });
    }

    next();
  };
};
