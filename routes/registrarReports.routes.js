const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireCapability, CAPABILITIES } = require('../middleware/academicPermissions');
const registrarReportsController = require('../controllers/registrarReports.controller');
const registrarController = require('../controllers/registrar.controller');

router.use(protect, requireCapability(CAPABILITIES.VIEW_LIFECYCLE));

router.get('/enrollment-summary', registrarController.enrollmentSummaryReport);
router.get('/term-completion', registrarReportsController.getTermCompletionReport);
router.get('/amendments', registrarReportsController.getAmendmentReport);
router.get('/policy-changes', registrarReportsController.getPolicyChangeReport);
router.get('/finalized-courses', registrarReportsController.getFinalizedCoursesReport);
router.get('/india', registrarReportsController.listIndiaReportKinds);
router.get('/india/:kind', registrarReportsController.getIndiaReport);

module.exports = router;
