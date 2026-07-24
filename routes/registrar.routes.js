const express = require('express');
const { protect } = require('../middleware/auth');
const { requireCapability, CAPABILITIES } = require('../middleware/academicPermissions');
const ctrl = require('../controllers/registrar.controller');

const router = express.Router();

router.use(protect);

router.get(
  '/dashboard',
  requireCapability(CAPABILITIES.VIEW_REGISTRAR_DASHBOARD),
  ctrl.getDashboard
);
router.get(
  '/students/search',
  requireCapability(CAPABILITIES.VIEW_REGISTRAR_DASHBOARD),
  ctrl.searchStudents
);
router.get(
  '/programs',
  requireCapability(CAPABILITIES.VIEW_REGISTRAR_DASHBOARD),
  ctrl.listPrograms
);
router.post(
  '/programs',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  ctrl.createProgram
);
router.patch(
  '/programs/:id',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  ctrl.updateProgram
);
router.get(
  '/students/:id/enrollments',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  ctrl.listStudentEnrollments
);
router.patch(
  '/students/:id/profile',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  ctrl.updateStudentProfile
);
router.get(
  '/students/:id',
  requireCapability(CAPABILITIES.VIEW_REGISTRAR_DASHBOARD),
  ctrl.getStudentStub
);
router.get(
  '/terms/:termId/grade-status',
  requireCapability(CAPABILITIES.VIEW_LIFECYCLE),
  ctrl.getTermGradeStatus
);
router.get(
  '/terms/:termId/grades-dashboard',
  requireCapability(CAPABILITIES.VIEW_LIFECYCLE),
  ctrl.getTermGradesDashboard
);
router.post(
  '/terms/:termId/finalize/preview',
  requireCapability(CAPABILITIES.FINALIZE_GRADES),
  ctrl.previewTermFinalize
);
router.post(
  '/terms/:termId/finalize',
  requireCapability(CAPABILITIES.FINALIZE_GRADES),
  ctrl.applyTermFinalize
);
router.get(
  '/terms/:termId/grading-periods',
  requireCapability(CAPABILITIES.VIEW_LIFECYCLE),
  ctrl.listInstitutionGradingPeriods
);
router.post(
  '/terms/:termId/grading-periods',
  requireCapability(CAPABILITIES.FINALIZE_GRADES),
  ctrl.createInstitutionGradingPeriod
);
router.post(
  '/terms/:termId/grading-periods/inherit',
  requireCapability(CAPABILITIES.FINALIZE_GRADES),
  ctrl.inheritGradingPeriods
);
router.patch(
  '/grading-periods/:id',
  requireCapability(CAPABILITIES.FINALIZE_GRADES),
  ctrl.updateInstitutionGradingPeriod
);
router.post(
  '/grading-periods/:id/close',
  requireCapability(CAPABILITIES.FINALIZE_GRADES),
  ctrl.closeInstitutionGradingPeriod
);
router.get(
  '/jobs/:jobId',
  requireCapability(CAPABILITIES.VIEW_LIFECYCLE),
  ctrl.getTermFinalizeJob
);
router.get(
  '/jobs/:jobId/download',
  requireCapability(CAPABILITIES.VIEW_LIFECYCLE),
  ctrl.downloadRegistrarJobExport
);

router.get(
  '/transcripts/templates',
  requireCapability(CAPABILITIES.VIEW_REGISTRAR_DASHBOARD),
  ctrl.listTranscriptTemplates
);
router.post(
  '/transcripts/templates',
  requireCapability(CAPABILITIES.RECOMPUTE_GRADES),
  ctrl.createTranscriptTemplate
);
router.patch(
  '/transcripts/templates/:id',
  requireCapability(CAPABILITIES.RECOMPUTE_GRADES),
  ctrl.updateTranscriptTemplate
);
router.get(
  '/transcripts/requests',
  requireCapability(CAPABILITIES.VIEW_REGISTRAR_DASHBOARD),
  ctrl.listTranscriptRequests
);
router.post(
  '/transcripts/requests',
  requireCapability(CAPABILITIES.RECOMPUTE_GRADES),
  ctrl.createTranscriptRequest
);
router.patch(
  '/transcripts/requests/:id',
  requireCapability(CAPABILITIES.RECOMPUTE_GRADES),
  ctrl.patchTranscriptRequest
);
router.post(
  '/transcripts/requests/:id/fulfill',
  requireCapability(CAPABILITIES.RECOMPUTE_GRADES),
  ctrl.fulfillTranscriptRequest
);
router.post(
  '/transcripts/issue',
  requireCapability(CAPABILITIES.RECOMPUTE_GRADES),
  ctrl.issueOfficialTranscriptOffice
);
router.post(
  '/transcripts/bulk/preview',
  requireCapability(CAPABILITIES.RECOMPUTE_GRADES),
  ctrl.previewBulkTranscriptIssue
);
router.post(
  '/transcripts/bulk',
  requireCapability(CAPABILITIES.RECOMPUTE_GRADES),
  ctrl.applyBulkTranscriptIssue
);

router.get(
  '/terms/:termId/enrollments',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  ctrl.listTermEnrollments
);
router.get(
  '/sections/:sectionId/roster',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  ctrl.getSectionRoster
);
router.get(
  '/sections/:sectionId/roster.csv',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  ctrl.exportSectionRoster
);
router.post(
  '/sections/:sectionId/link-course',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  ctrl.linkOrCreateSectionCourse
);
router.post(
  '/courses/:courseId/repair-snapshots',
  requireCapability(CAPABILITIES.FINALIZE_GRADES),
  ctrl.repairCourseSnapshots
);
router.get(
  '/structure/gaps',
  requireCapability(CAPABILITIES.VIEW_REGISTRAR_DASHBOARD),
  ctrl.structureGapReport
);
router.post(
  '/structure/backfill',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  ctrl.backfillStructure
);
router.post(
  '/enrollments/preview',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  ctrl.previewEnrollments
);
router.post(
  '/enrollments/bulk',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  ctrl.bulkEnroll
);
router.post(
  '/enrollments/drop',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  ctrl.dropEnrollment
);
router.post(
  '/enrollments/transfer',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  ctrl.transferEnrollmentHandler
);
router.post(
  '/enrollments/:id/transfer',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  ctrl.transferEnrollmentHandler
);
router.patch(
  '/enrollments/:id',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  ctrl.patchEnrollmentHandler
);
router.get(
  '/courses/:courseId/waitlist',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  ctrl.listCourseWaitlist
);
router.post(
  '/courses/:courseId/waitlist/promote',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  ctrl.promoteWaitlist
);
router.post(
  '/sections/:sectionId/waitlist/promote',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  async (req, res, next) => {
    try {
      const CourseSection = require('../models/courseSection.model');
      const { withTenantFilter, rootAccountIdFromRequest } = require('../utils/tenantContext');
      const tenantId = rootAccountIdFromRequest(req);
      const section = await CourseSection.findOne(
        withTenantFilter({ _id: req.params.sectionId }, tenantId)
      ).lean();
      if (!section?.lmsCourseId) {
        return res.status(404).json({ success: false, message: 'Section or linked course not found' });
      }
      req.params.courseId = String(section.lmsCourseId);
      return ctrl.promoteWaitlist(req, res, next);
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);
router.post(
  '/terms/:termId/conclude',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  ctrl.concludeTermEnrollments
);
router.post(
  '/courses/:courseId/sync-roster',
  requireCapability(CAPABILITIES.MANAGE_ENROLLMENTS),
  ctrl.syncCourseRoster
);
router.get(
  '/reports/enrollment-summary',
  requireCapability(CAPABILITIES.VIEW_LIFECYCLE),
  ctrl.enrollmentSummaryReport
);

router.get('/holds', requireCapability(CAPABILITIES.MANAGE_HOLDS), ctrl.listHolds);
router.post('/holds', requireCapability(CAPABILITIES.MANAGE_HOLDS), ctrl.placeHold);
router.post('/holds/:id/release', requireCapability(CAPABILITIES.MANAGE_HOLDS), ctrl.releaseHold);

router.post('/sis/stage', requireCapability(CAPABILITIES.MANAGE_SIS), ctrl.stageSisImport);
router.post('/sis/import/:kind', requireCapability(CAPABILITIES.MANAGE_SIS), ctrl.importSisKind);
router.get('/sis/staging', requireCapability(CAPABILITIES.MANAGE_SIS), ctrl.listSisStaging);
router.patch('/sis/staging/:id', requireCapability(CAPABILITIES.MANAGE_SIS), ctrl.patchSisStagingRow);
router.post('/sis/apply', requireCapability(CAPABILITIES.MANAGE_SIS), ctrl.applySisBatch);
router.get('/sis/jobs', requireCapability(CAPABILITIES.MANAGE_SIS), ctrl.listSisJobs);
router.get('/sis/batches', requireCapability(CAPABILITIES.MANAGE_SIS), ctrl.listSisBatches);
router.get('/sis/config', requireCapability(CAPABILITIES.MANAGE_SIS), ctrl.getSisConfig);
router.put('/sis/config', requireCapability(CAPABILITIES.MANAGE_SIS), ctrl.updateSisConfig);
router.get('/sis/grades/export', requireCapability(CAPABILITIES.MANAGE_SIS), ctrl.exportSisGrades);
router.post('/sis/grades/export', requireCapability(CAPABILITIES.MANAGE_SIS), ctrl.exportSisGrades);
router.get('/sis/grades/passbacks', requireCapability(CAPABILITIES.MANAGE_SIS), ctrl.listGradePassbacks);
router.get('/sis/adapters', requireCapability(CAPABILITIES.MANAGE_SIS), ctrl.listSisAdapters);
router.get('/sis/health', requireCapability(CAPABILITIES.MANAGE_SIS), ctrl.getSisHealth);
router.post('/sis/sync/run', requireCapability(CAPABILITIES.MANAGE_SIS), ctrl.runSisSync);
router.post('/sis/batches/:batchId/retry', requireCapability(CAPABILITIES.MANAGE_SIS), ctrl.retrySisBatch);
router.get(
  '/integrations/status',
  requireCapability(CAPABILITIES.VIEW_REGISTRAR_DASHBOARD),
  ctrl.getIntegrationsStatus
);
router.get('/sis/mapping-presets', requireCapability(CAPABILITIES.MANAGE_SIS), ctrl.getSisMappingPresets);

module.exports = router;
