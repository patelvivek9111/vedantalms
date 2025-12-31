const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    console.error('Authentication failed: No token provided');
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }

  

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    
    const user = await User.findById(decoded.id);

    if (!user) {
      console.error('Authentication failed: User not found for token');
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }


    req.user = user;
    next();
  } catch (err) {
    console.error('Authentication failed:', err.message);
    console.error('JWT verification error details:', err);
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // Flatten the roles array in case it's nested
    const allowedRoles = roles.flat();
    
    if (!req.user || !req.user.role) {
      console.error('Authorization failed: No user or role found in request');
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      console.error(`Authorization failed: User role ${req.user.role} not authorized for roles: ${allowedRoles.join(', ')}`);
      return res.status(403).json({
        success: false,
        error: `User role ${req.user.role} is not authorized to access this route`
      });
    }

    next();
  };
}; 