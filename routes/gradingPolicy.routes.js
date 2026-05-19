const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect, authorize } = require('../middleware/auth');
const { requireCapability, CAPABILITIES } = require('../middleware/academicPermissions');
const gradingPolicyController = require('../controllers/gradingPolicy.controller');

const skipLimit = () => process.env.DISABLE_RATE_LIMIT === 'true';

const recomputeLimiter = rateLimit({
  windowMs: parseInt(process.env.RECOMPUTE_RATE_WINDOW_MS || `${60 * 1000}`, 10),
  max: parseInt(process.env.RECOMPUTE_RATE_MAX || '20', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many recompute requests.' },
  skip: skipLimit,
});

router.get(
  '/institution',
  protect,
  authorize('admin', 'registrar'),
  gradingPolicyController.getInstitutionGradingPolicy
);
router.put(
  '/institution',
  protect,
  authorize('admin', 'registrar'),
  gradingPolicyController.updateInstitutionGradingPolicy
);

router.get(
  '/course/:courseId',
  protect,
  gradingPolicyController.getCourseGradingPolicy
);
router.put(
  '/course/:courseId',
  protect,
  gradingPolicyController.updateCourseGradingPolicy
);
router.post(
  '/course/:courseId/preview',
  protect,
  gradingPolicyController.previewCourseGradingPolicy
);
router.get(
  '/course/:courseId/effective',
  protect,
  gradingPolicyController.getCourseEffectiveGradingPolicy
);
router.get(
  '/audit/:entityType/:entityId',
  protect,
  gradingPolicyController.getGradingPolicyAuditHistory
);

router.post(
  '/transcript/recompute',
  protect,
  recomputeLimiter,
  requireCapability(CAPABILITIES.RECOMPUTE_GRADES),
  gradingPolicyController.recomputeTranscriptGrades
);

module.exports = router;
