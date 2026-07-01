const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { extractTokenFromSocketHandshake } = require('../utils/authCookie');

async function authenticateSocket(socket, next) {
  try {
    const token = extractTokenFromSocketHandshake(socket);

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-123'
    );

    const user = await User.findById(decoded.id).select('accountStatus tokenVersion role');
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }
    if (user.accountStatus === 'suspended') {
      return next(new Error('Authentication error: Account suspended'));
    }
    const tokenVersion = decoded.tv ?? 0;
    if (tokenVersion !== (user.tokenVersion || 0)) {
      return next(new Error('Authentication error: Session expired'));
    }

    socket.userId = decoded.id;
    socket.userRole = user.role || decoded.role;
    return next();
  } catch {
    return next(new Error('Authentication error: Invalid token'));
  }
}

module.exports = { authenticateSocket };
