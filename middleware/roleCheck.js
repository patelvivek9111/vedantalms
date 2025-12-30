const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const roleCheck = (roles) => {
  return async (req, res, next) => {
    try {
      // Get token from header
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ message: 'No authentication token, access denied' });
      }

      // Verify token (use fallback for safety)
      const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-123';
      const decoded = jwt.verify(token, jwtSecret);
      
      // Get user from database (JWT payload uses 'id' not 'userId')
      const user = await User.findById(decoded.id || decoded.userId);
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Check if user's role is allowed
      if (!roles.includes(user.role)) {
        return res.status(403).json({ 
          message: 'Access denied. You do not have permission to perform this action.' 
        });
      }

      // Add user to request object
      req.user = user;
      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(401).json({ message: 'Token is invalid or expired' });
    }
  };
};

module.exports = roleCheck; 