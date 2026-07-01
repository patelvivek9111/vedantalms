const { extractTokenFromRequest } = require('../utils/authCookie');
const jwt = require('jsonwebtoken');

/**
 * Protect /metrics in production. Accepts METRICS_TOKEN bearer or admin JWT.
 */
function metricsAuth(req, res, next) {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const metricsToken = process.env.METRICS_TOKEN;
  const authHeader = req.headers.authorization || '';
  if (metricsToken && authHeader === `Bearer ${metricsToken}`) {
    return next();
  }

  const token = extractTokenFromRequest(req);
  if (!token) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role === 'admin') {
      return next();
    }
  } catch {
    /* fall through */
  }

  return res.status(401).send('Unauthorized');
}

module.exports = { metricsAuth };
