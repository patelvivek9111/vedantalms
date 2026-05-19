const path = require('path');
const StudentCourseGradeSnapshot = require('../../models/studentCourseGradeSnapshot.model');
const TranscriptIssueLog = require('../../models/transcriptIssueLog.model');
const { checksumDoc } = require('../../models/plugins/immutableAppendOnly.plugin');
const { getStorageService } = require('../storage');

function getArchiveAdapter() {
  return getStorageService().archives;
}

/**
 * Export frozen snapshots + transcript issuance metadata for DR validation.
 * Does not mutate source records.
 */
async function archiveFrozenSnapshotsForCourse(courseId, { term, year } = {}) {
  const archive = getArchiveAdapter();
  const query = { course: courseId, frozen: true };
  if (term) query.term = term;
  if (year) query.year = Number(year);

  const snapshots = await StudentCourseGradeSnapshot.find(query).lean();
  const checksums = snapshots.map((s) => ({
    id: String(s._id),
    checksum: checksumDoc(s),
    gradingPolicyHash: s.gradingPolicyHash,
  }));

  const payload = {
    archivedAt: new Date().toISOString(),
    courseId: String(courseId),
    term: term || null,
    year: year || null,
    snapshotCount: snapshots.length,
    checksums,
    snapshots,
  };

  const fileName = `snapshots-${courseId}-${Date.now()}.json`;
  const result = await archive.writeFile(fileName, payload);
  return { filePath: result.path, fileName, snapshotCount: snapshots.length, checksums };
}

async function archiveTranscriptIssuance(studentId, term, year) {
  const archive = getArchiveAdapter();
  const logs = await TranscriptIssueLog.find({ student: studentId, term, year: Number(year) })
    .sort({ createdAt: -1 })
    .lean();

  const fileName = `transcript-issue-${studentId}-${term}-${year}-${Date.now()}.json`;
  const result = await archive.writeFile(
    fileName,
    { archivedAt: new Date().toISOString(), logs }
  );
  return { filePath: result.path, fileName, count: logs.length };
}

module.exports = {
  getArchiveAdapter,
  archiveFrozenSnapshotsForCourse,
  archiveTranscriptIssuance,
};
