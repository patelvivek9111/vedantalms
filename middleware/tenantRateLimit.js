const { assertApiRateLimit } = require('../services/tenancy/accountQuota.service');
const { rootAccountIdFromRequest } = require('../utils/tenantContext');

/**
 * Soft per-tenant API rate limit (after tenant resolve).
 * Skips when no root or Redis unavailable.
 */
function tenantRateLimit(req, res, next) {
  const rootId = rootAccountIdFromRequest(req);
  if (!rootId) return next();
  if (req.user?.role === 'platform_admin') return next();

  assertApiRateLimit(rootId)
    .then(() => next())
    .catch((err) => {
      if (err.code === 'TENANT_RATE_LIMIT') {
        return res.status(429).json({
          success: false,
          message: err.message,
          code: err.code,
        });
      }
      return next();
    });
}

module.exports = { tenantRateLimit };
