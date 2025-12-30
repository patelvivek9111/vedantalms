const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const logger = require('../utils/logger');
const { UnauthorizedError, ForbiddenError, sendErrorResponse } = require('../utils/errorHandler');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    logger.warn('Authentication failed: No token provided', { path: req.path, method: req.method });
    return sendErrorResponse(res, new UnauthorizedError(), { action: 'auth_protect', reason: 'no_token' });
  }

  

  try {
    // JWT_SECRET must be set in environment variables
    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET is not configured in environment variables', { path: req.path });
      return sendErrorResponse(res, new UnauthorizedError('Authentication configuration error'), { action: 'auth_protect', reason: 'jwt_secret_missing' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    
    const user = await User.findById(decoded.id);

    if (!user) {
      logger.warn('Authentication failed: User not found for token', { userId: decoded.id, path: req.path });
      return sendErrorResponse(res, new UnauthorizedError(), { action: 'auth_protect', reason: 'user_not_found' });
    }


    req.user = user;
    next();
  } catch (err) {
    logger.warn('Authentication failed: JWT verification error', { 
      error: err.message, 
      name: err.name,
      path: req.path 
    });
    return sendErrorResponse(res, new UnauthorizedError(), { action: 'auth_protect', reason: 'jwt_verification_failed' });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // Flatten the roles array in case it's nested
    const allowedRoles = roles.flat();
    
    if (!req.user || !req.user.role) {
      logger.warn('Authorization failed: No user or role found in request', { path: req.path });
      return sendErrorResponse(res, new ForbiddenError('User role not found'), { action: 'auth_authorize', reason: 'no_role' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Authorization failed: Insufficient permissions', { 
        userRole: req.user.role, 
        allowedRoles, 
        path: req.path 
      });
      return sendErrorResponse(res, new ForbiddenError(`User role ${req.user.role} is not authorized to access this route`), { 
        action: 'auth_authorize', 
        reason: 'insufficient_permissions',
        userRole: req.user.role,
        allowedRoles 
      });
    }

    next();
  };
}; 