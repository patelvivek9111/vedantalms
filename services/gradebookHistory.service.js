const mongoose = require('mongoose');
const GradebookCellHistory = require('../models/gradebookCellHistory.model');

function cellHistoryKey(studentId, assignmentId) {
  return `${String(studentId)}_${String(assignmentId)}`;
}

async function recordGradeChange({
  courseId,
  assignmentId,
  studentId,
  previousGrade,
  newGrade,
  previousExcused = false,
  newExcused = false,
  changeType = 'grade',
  changedBy,
  metadata = null,
}) {
  const prev = previousGrade ?? null;
  const next = newGrade ?? null;
  if (prev === next && previousExcused === newExcused) return null;

  return GradebookCellHistory.create({
    course: courseId,
    assignment: assignmentId,
    student: studentId,
    previousGrade: prev,
    newGrade: next,
    previousExcused,
    newExcused,
    changeType,
    changedBy,
    metadata,
  });
}

async function listCellHistory({ courseId, studentId, assignmentId, limit = 50 }) {
  const query = { course: courseId };
  if (studentId) query.student = studentId;
  if (assignmentId) query.assignment = assignmentId;
  return GradebookCellHistory.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 200))
    .populate('changedBy', 'firstName lastName email')
    .lean();
}

/**
 * Returns Set of `${studentId}_${assignmentId}` keys that have at least one history row.
 */
async function batchCellsWithHistory(courseId, studentIds = [], assignmentIds = []) {
  const cells = new Set();
  const students = [...new Set(studentIds.map(String).filter(Boolean))];
  const assignments = [...new Set(assignmentIds.map(String).filter(Boolean))];
  if (!courseId || !students.length || !assignments.length) return cells;

  const courseOid = mongoose.Types.ObjectId.isValid(String(courseId))
    ? new mongoose.Types.ObjectId(String(courseId))
    : courseId;
  const studentOids = students
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const assignmentOids = assignments
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!studentOids.length || !assignmentOids.length) return cells;

  const rows = await GradebookCellHistory.aggregate([
    {
      $match: {
        course: courseOid,
        student: { $in: studentOids },
        assignment: { $in: assignmentOids },
      },
    },
    { $group: { _id: { student: '$student', assignment: '$assignment' } } },
  ]);

  for (const row of rows) {
    cells.add(cellHistoryKey(row._id.student, row._id.assignment));
  }
  return cells;
}

module.exports = {
  recordGradeChange,
  listCellHistory,
  batchCellsWithHistory,
  cellHistoryKey,
};
