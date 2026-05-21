const fileAccessService = require('../services/fileAccess.service');

/**
 * Express middleware — attach authorized file asset to req.fileAsset.
 */
function requireFileAccess(paramName = 'id') {
  return async (req, res, next) => {
    try {
      const fileAssetId = req.params[paramName];
      const result = await fileAccessService.assertCanAccessFileAsset(req.user, fileAssetId, {
        ip: req.ip,
        requestId: req.requestId,
      });
      req.fileAsset = result.asset;
      req.fileCourse = result.course;
      next();
    } catch (error) {
      res.status(error.statusCode || 403).json({ success: false, message: error.message });
    }
  };
}

module.exports = { requireFileAccess };
