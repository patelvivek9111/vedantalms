const CourseGradeLifecycle = require('../models/courseGradeLifecycle.model');
const GradeAmendmentRecord = require('../models/gradeAmendmentRecord.model');
const GradingPolicyAudit = require('../models/gradingPolicyAudit.model');
const { Parser } = require('json2csv');

function csvFromRows(rows) {
  if (!rows.length) return '';
  const parser = new Parser();
  return parser.parse(rows);
}

exports.getTermCompletionReport = async (req, res) => {
  try {
    const { term, year } = req.query;
    const query = {};
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
    const rows = await GradeAmendmentRecord.find({})
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
    const rows = await GradingPolicyAudit.find({})
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
    const rows = await CourseGradeLifecycle.find({ status: 'FINALIZED' })
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
