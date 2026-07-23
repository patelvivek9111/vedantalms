const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { extractTokenFromRequest } = require('../utils/authCookie');
const { getSecurityPolicy } = require('../services/securityPolicy.service');

const ALLOWED_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/admin/security/config',
  '/api/admin/security/posture',
]);

function isAllowedPublicPath(req) {
  if (req.method === 'OPTIONS') return true;
  if (ALLOWED_PATHS.has(req.path)) return true;
  return req.path.startsWith('/api/admin/security/');
}

async function resolveRequestUser(req) {
  if (req.user) return req.user;
  const token = extractTokenFromRequest(req);
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('role accountStatus tokenVersion');
    if (!user || user.accountStatus === 'suspended') return null;
    const tokenVersion = decoded.tv ?? 0;
    if (tokenVersion !== (user.tokenVersion || 0)) return null;
    return user;
  } catch {
    return null;
  }
}

module.exports = async function maintenanceMode(req, res, next) {
  const policy = getSecurityPolicy();
  if (!policy.maintenanceMode) return next();

  if (isAllowedPublicPath(req)) {
    return next();
  }

  const user = await resolveRequestUser(req);
  if (user?.role === 'admin' || user?.role === 'platform_admin') {
    req.user = req.user || user;
    return next();
  }

  return res.status(503).json({
    success: false,
    message: 'The system is under maintenance. Please try again later.',
  });
};
