const StudentCourseGradeSnapshot = require('../../models/studentCourseGradeSnapshot.model');
const TranscriptIssueLog = require('../../models/transcriptIssueLog.model');
const CourseGradeLifecycle = require('../../models/courseGradeLifecycle.model');

/**
 * Append-only / immutability guards for restore (Phase R2).
 * Never silently overwrite finalized academic records.
 */
async function checkFrozenSnapshotConflict(doc, mode) {
  const existing = await StudentCourseGradeSnapshot.findOne({
    student: doc.student,
    course: doc.course,
    term: doc.term ?? null,
    year: doc.year ?? null,
    frozen: true,
    isCurrent: true,
  }).lean();

  if (!existing) return { action: 'insert', conflict: null };

  const sameId = String(existing._id) === String(doc._id);
  if (sameId) return { action: mode === 'merge' ? 'skip' : 'skip', conflict: null };

  return {
    action: 'skip',
    conflict: {
      type: 'frozen_snapshot_exists',
      existingId: String(existing._id),
      incomingId: String(doc._id),
    },
  };
}

async function checkTranscriptSnapshotConflict(doc) {
  const existing = await TranscriptIssueLog.findById(doc._id).lean();
  if (!existing) return { action: 'insert', conflict: null };
  return {
    action: 'skip',
    conflict: { type: 'transcript_snapshot_exists', id: String(doc._id) },
  };
}

async function checkLifecycleConflict(doc) {
  const existing = await CourseGradeLifecycle.findOne({
    course: doc.course,
    term: doc.term,
    year: doc.year,
  }).lean();

  if (!existing) return { action: 'insert', conflict: null };
  if (existing.status === 'FINALIZED' && doc.status === 'FINALIZED') {
    return {
      action: 'skip',
      conflict: { type: 'finalized_lifecycle_exists', id: String(existing._id) },
    };
  }
  return { action: 'merge', conflict: null };
}

module.exports = {
  checkFrozenSnapshotConflict,
  checkTranscriptSnapshotConflict,
  checkLifecycleConflict,
};
