const CourseGradeLifecycle = require('../models/courseGradeLifecycle.model');
const GradeAmendmentRecord = require('../models/gradeAmendmentRecord.model');
const GradingPolicyAudit = require('../models/gradingPolicyAudit.model');
const Course = require('../models/course.model');
const { Parser } = require('json2csv');
const { withTenantFilter, rootAccountIdFromRequest } = require('../utils/tenantContext');

function csvFromRows(rows) {
  if (!rows.length) return '';
  const parser = new Parser();
  return parser.parse(rows);
}

exports.getTermCompletionReport = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const { term, year } = req.query;
    const query = withTenantFilter({}, tenantId);
    if (term) query.term = term;
    if (year) query.year = Number(year);

    const rows = await CourseGradeLifecycle.find(query)
      .populate('course', 'title catalog')
      .sort({ finalizedAt: -1 })
      .lean();

    const data = rows.map((r) => ({
      courseId: String(r.course?._id || r.course),
      courseTitle: r.course?.title,
      term: r.term,
      year: r.year,
      status: r.status,
      finalizedAt: r.finalizedAt,
      studentSnapshotCount: r.studentSnapshotCount,
      policyHash: r.policyHash,
    }));

    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      return res.send(csvFromRows(data));
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAmendmentReport = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const courseIds = await Course.find(withTenantFilter({}, tenantId)).distinct('_id');
    const rows = await GradeAmendmentRecord.find({ course: { $in: courseIds } })
      .sort({ createdAt: -1 })
      .limit(parseInt(req.query.limit || '500', 10))
      .populate('course', 'title')
      .populate('amendedBy', 'firstName lastName email role')
      .lean();

    const data = rows.map((r) => ({
      courseId: String(r.course?._id || r.course),
      courseTitle: r.course?.title,
      term: r.term,
      year: r.year,
      sequence: r.sequence,
      reason: r.reason,
      amendedBy: r.amendedBy?.email,
      studentCount: r.studentCount,
      createdAt: r.createdAt,
    }));

    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      return res.send(csvFromRows(data));
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPolicyChangeReport = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const filter = tenantId
      ? {
          $or: [{ rootAccountId: tenantId }, { 'meta.rootAccountId': tenantId }],
        }
      : withTenantFilter({}, null);
    const rows = await GradingPolicyAudit.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(req.query.limit || '500', 10))
      .populate('actor', 'firstName lastName email role')
      .lean();

    const data = rows.map((r) => ({
      entityType: r.entityType,
      entityId: r.entityId,
      oldHash: r.oldHash,
      newHash: r.newHash,
      actor: r.actor?.email,
      reason: r.reason,
      createdAt: r.createdAt,
    }));

    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      return res.send(csvFromRows(data));
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFinalizedCoursesReport = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const rows = await CourseGradeLifecycle.find(
      withTenantFilter({ status: 'FINALIZED' }, tenantId)
    )
      .populate('course', 'title catalog')
      .sort({ finalizedAt: -1 })
      .lean();

    const data = rows.map((r) => ({
      courseId: String(r.course?._id || r.course),
      courseTitle: r.course?.title,
      term: r.term,
      year: r.year,
      finalizedAt: r.finalizedAt,
      policyHash: r.policyHash,
      gradingEngineVersion: r.gradingEngineVersion,
      studentSnapshotCount: r.studentSnapshotCount,
    }));

    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      return res.send(csvFromRows(data));
    }
    res.json({ success: true, data, pdfReady: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** India demo pack reports (CSV scaffolds). */
exports.getIndiaReport = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const indiaReports = require('../services/registrar/indiaReports.service');
    const kind = req.params.kind;
    const params = {
      studentId: req.query.studentId || req.body?.studentId,
      courseId: req.query.courseId || req.body?.courseId,
      term: req.query.term || req.body?.term,
      year: req.query.year || req.body?.year,
    };
    const data = await indiaReports.runIndiaReport(kind, tenantId, params);
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${kind}.csv"`);
      return res.send(data.csvText);
    }
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.listIndiaReportKinds = async (req, res) => {
  const indiaReports = require('../services/registrar/indiaReports.service');
  const boardSubmit = require('../services/registrar/boardSubmit.service');
  return res.json({
    success: true,
    data: indiaReports.REPORT_KINDS.map((k) => ({ key: k })),
    board: boardSubmit.getBoardHealth(),
  });
};

exports.submitIndiaReport = async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    const boardSubmit = require('../services/registrar/boardSubmit.service');
    const data = await boardSubmit.submitIndiaReport({
      tenantId,
      kind: req.params.kind,
      params: {
        studentId: req.body?.studentId || req.query.studentId,
        courseId: req.body?.courseId || req.query.courseId,
        term: req.body?.term || req.query.term,
        year: req.body?.year || req.query.year,
      },
      submittedBy: req.user?._id,
      dryRun: req.body?.dryRun === true,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};
