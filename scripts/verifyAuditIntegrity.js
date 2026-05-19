#!/usr/bin/env node
/**
 * Validates append-only academic audit records and frozen snapshot checksums.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const SystemAuditEvent = require('../models/systemAuditEvent.model');
const StudentCourseGradeSnapshot = require('../models/studentCourseGradeSnapshot.model');
const GradeAmendmentRecord = require('../models/gradeAmendmentRecord.model');
const TranscriptIssueLog = require('../models/transcriptIssueLog.model');
const { checksumDoc } = require('../models/plugins/immutableAppendOnly.plugin');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
  await mongoose.connect(uri, { dbName: 'lms' });

  const issues = [];

  const frozen = await StudentCourseGradeSnapshot.find({ frozen: true }).limit(5000).lean();
  for (const snap of frozen) {
    if (!snap.gradingPolicyHash || !snap.gradingPolicySnapshot) {
      issues.push({ type: 'snapshot_missing_policy', id: String(snap._id) });
    }
    const expected = checksumDoc(snap);
    if (snap.recordChecksum && snap.recordChecksum !== expected) {
      issues.push({ type: 'snapshot_checksum_mismatch', id: String(snap._id) });
    }
  }

  const auditCount = await SystemAuditEvent.countDocuments();
  const amendmentCount = await GradeAmendmentRecord.countDocuments();
  const transcriptIssueCount = await TranscriptIssueLog.countDocuments();

  console.log(JSON.stringify({
    ok: issues.length === 0,
    frozenSnapshotsChecked: frozen.length,
    systemAuditEvents: auditCount,
    amendmentRecords: amendmentCount,
    transcriptIssueLogs: transcriptIssueCount,
    issues,
  }, null, 2));

  await mongoose.disconnect();
  process.exit(issues.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
