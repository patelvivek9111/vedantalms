const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireCapability, CAPABILITIES } = require('../middleware/academicPermissions');
const registrarReportsController = require('../controllers/registrarReports.controller');

router.use(protect, requireCapability(CAPABILITIES.VIEW_LIFECYCLE));

router.get('/term-completion', registrarReportsController.getTermCompletionReport);
router.get('/amendments', registrarReportsController.getAmendmentReport);
router.get('/policy-changes', registrarReportsController.getPolicyChangeReport);
router.get('/finalized-courses', registrarReportsController.getFinalizedCoursesReport);

module.exports = router;
