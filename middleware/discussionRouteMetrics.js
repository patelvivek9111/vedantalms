'use strict';

const discussionObservability = require('../services/discussionObservability.service');

function anonymizePath(pathname) {
  if (!pathname || typeof pathname !== 'string') return pathname;
  return pathname.replace(/[a-f0-9]{24}/gi, ':id');
}

/**
 * Emits structured discussion HTTP metrics on response finish (Phase F observability).
 */
function discussionRouteMetrics(prefix) {
  return (req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      const path = anonymizePath(req.originalUrl ? String(req.originalUrl).split('?')[0] : req.path);
      discussionObservability.routeLatency({
        prefix,
        method: req.method || null,
        path,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        actorRole: req.user?.role || null,
      });
    });
    next();
  };
}

module.exports = discussionRouteMetrics;
