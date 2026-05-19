const crypto = require('crypto');

/**
 * Attach request + audit correlation IDs for structured logging and FERPA audit trails.
 */
function requestCorrelation(req, res, next) {
  const incoming = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  req.requestId = incoming && String(incoming).length <= 128
    ? String(incoming)
    : crypto.randomBytes(16).toString('hex');
  req.auditCorrelationId = req.headers['x-audit-correlation-id']
    ? String(req.headers['x-audit-correlation-id']).slice(0, 128)
    : req.requestId;
  res.setHeader('X-Request-Id', req.requestId);
  res.setHeader('X-Audit-Correlation-Id', req.auditCorrelationId);
  next();
}

module.exports = { requestCorrelation };
