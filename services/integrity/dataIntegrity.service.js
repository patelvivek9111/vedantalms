const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { checksumDoc } = require('../../models/plugins/immutableAppendOnly.plugin');
const { validateExportManifest, verifySectionHashes } = require('../../shared/portability/exportManifest.cjs');
const { hashContent } = require('../../shared/portability/exportUtils.cjs');

/**
 * Unified institution data integrity verification (Phase R3).
 */
async function runDataIntegrityChecks(options = {}) {
  const issues = [];
  const summary = {};

  const Submission = require('../../models/Submission');
  const Assignment = require('../../models/Assignment');
  const StudentCourseGradeSnapshot = require('../../models/studentCourseGradeSnapshot.model');
  const CourseGradeLifecycle = require('../../models/courseGradeLifecycle.model');
  const TranscriptIssueLog = require('../../models/transcriptIssueLog.model');
  const GradingPolicyAudit = require('../../models/gradingPolicyAudit.model');
  const Course = require('../../models/course.model');
  const User = require('../../models/user.model');
  const CourseGradingPolicy = require('../../models/courseGradingPolicy.model');
  const InstitutionGradingPolicy = require('../../models/institutionGradingPolicy.model');

  // Orphaned submissions
  const orphanSubs = await Submission.aggregate([
    {
      $lookup: {
        from: 'assignments',
        localField: 'assignment',
        foreignField: '_id',
        as: 'a',
      },
    },
    { $match: { a: { $size: 0 } } },
    { $limit: 50 },
    { $project: { _id: 1 } },
  ]);
  if (orphanSubs.length) {
    issues.push({ type: 'orphaned_submissions', count: orphanSubs.length, samples: orphanSubs });
  }

  // Orphaned grade snapshots (missing course)
  const orphanSnaps = await StudentCourseGradeSnapshot.aggregate([
    {
      $lookup: { from: 'courses', localField: 'course', foreignField: '_id', as: 'c' },
    },
    { $match: { c: { $size: 0 } } },
    { $limit: 50 },
    { $project: { _id: 1, course: 1 } },
  ]);
  if (orphanSnaps.length) {
    issues.push({ type: 'orphaned_grade_snapshots', count: orphanSnaps.length, samples: orphanSnaps });
  }

  // Duplicate isCurrent
  const dupCurrent = await StudentCourseGradeSnapshot.aggregate([
    { $match: { isCurrent: true, term: { $type: 'string' }, year: { $type: 'number' } } },
    {
      $group: {
        _id: { student: '$student', course: '$course', term: '$term', year: '$year' },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $limit: 20 },
  ]);
  if (dupCurrent.length) {
    issues.push({ type: 'duplicate_is_current', samples: dupCurrent });
  }

  // Lifecycle / snapshot mismatches
  const finalized = await CourseGradeLifecycle.find({ status: 'FINALIZED' }).limit(200).lean();
  for (const lc of finalized) {
    const count = await StudentCourseGradeSnapshot.countDocuments({
      course: lc.course,
      term: lc.term,
      year: lc.year,
      frozen: true,
      isCurrent: true,
    });
    if (count === 0 && (lc.studentSnapshotCount || 0) > 0) {
      issues.push({
        type: 'lifecycle_snapshot_mismatch',
        lifecycleId: String(lc._id),
        expected: lc.studentSnapshotCount,
      });
    }
  }

  // Missing policy snapshots on frozen rows
  const frozen = await StudentCourseGradeSnapshot.find({ frozen: true }).limit(2000).lean();
  let missingPolicy = 0;
  let checksumMismatch = 0;
  for (const snap of frozen) {
    if (!snap.gradingPolicyHash || !snap.gradingPolicySnapshot) missingPolicy += 1;
    const expected = checksumDoc(snap);
    if (snap.recordChecksum && snap.recordChecksum !== expected) checksumMismatch += 1;
  }
  if (missingPolicy) issues.push({ type: 'missing_policy_snapshots', count: missingPolicy });
  if (checksumMismatch) issues.push({ type: 'corrupted_audit_chains', count: checksumMismatch });

  // Transcript consistency
  const transcriptRows = await TranscriptIssueLog.find({}).limit(500).lean();
  for (const row of transcriptRows) {
    if (!row.student || !row.course) {
      issues.push({ type: 'transcript_snapshot_inconsistency', id: String(row._id) });
    }
  }

  // Duplicate enrollments (student listed twice)
  const courses = await Course.find({}).select('students title').lean();
  for (const c of courses) {
    const ids = (c.students || []).map(String);
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
      issues.push({ type: 'duplicate_enrollments', courseId: String(c._id), title: c.title });
    }
  }

  // Invalid role assignments
  const validRoles = [
    'student',
    'teaching_assistant',
    'teacher',
    'department_admin',
    'registrar',
    'admin',
  ];
  const badRoles = await User.find({ role: { $nin: validRoles } }).limit(20).select('email role').lean();
  if (badRoles.length) {
    issues.push({ type: 'invalid_role_assignments', samples: badRoles });
  }

  // Missing institution policy
  const instPolicy = await InstitutionGradingPolicy.findOne({ key: 'default' }).lean();
  if (!instPolicy) issues.push({ type: 'missing_institution_policy' });

  const coursesWithoutPolicy = await Course.find({}).select('_id').lean();
  for (const c of coursesWithoutPolicy.slice(0, 100)) {
    const cp = await CourseGradingPolicy.findOne({ course: c._id }).lean();
    if (!cp && !instPolicy) {
      issues.push({ type: 'missing_policy_snapshot', courseId: String(c._id) });
    }
  }

  // Policy audit chain spot-check
  const auditSample = await GradingPolicyAudit.find({}).sort({ createdAt: -1 }).limit(5).lean();
  summary.policyAuditSample = auditSample.length;

  // Export bundle verification (optional path)
  if (options.exportDir) {
    const manifestPath = path.join(options.exportDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      issues.push({ type: 'missing_export_files', path: manifestPath });
    } else {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const validation = validateExportManifest(manifest);
      if (!validation.valid) {
        issues.push({ type: 'export_manifest_invalid', errors: validation.errors });
      }
      const hashByFile = {};
      for (const section of manifest.sections || []) {
        for (const file of section.files || [section.file].filter(Boolean)) {
          const fp = path.join(options.exportDir, file);
          if (!fs.existsSync(fp)) issues.push({ type: 'missing_export_files', file });
          else hashByFile[file] = hashContent(fs.readFileSync(fp, 'utf8'));
        }
      }
      const hashCheck = verifySectionHashes(manifest, hashByFile);
      if (!hashCheck.valid) issues.push({ type: 'export_hash_mismatch', details: hashCheck.issues });
    }
  }

  summary.orphanedSubmissions = orphanSubs.length;
  summary.orphanedSnapshots = orphanSnaps.length;
  summary.frozenSnapshotsChecked = frozen.length;
  summary.finalizedLifecycleRows = finalized.length;
  summary.transcriptRowsChecked = transcriptRows.length;

  return {
    ok: issues.length === 0,
    checkedAt: new Date().toISOString(),
    summary,
    issueCount: issues.length,
    issues,
  };
}

function formatHumanReport(result) {
  const lines = [
    '=== MySl8te Data Integrity Report ===',
    `Checked at: ${result.checkedAt}`,
    `Status: ${result.ok ? 'PASS' : 'FAIL'} (${result.issueCount} issue(s))`,
    '',
    'Summary:',
    JSON.stringify(result.summary, null, 2),
  ];
  if (result.issues.length) {
    lines.push('', 'Issues:');
    for (const issue of result.issues.slice(0, 50)) {
      lines.push(`- [${issue.type}] ${JSON.stringify(issue)}`);
    }
    if (result.issues.length > 50) lines.push(`... and ${result.issues.length - 50} more`);
  }
  return lines.join('\n');
}

module.exports = {
  runDataIntegrityChecks,
  formatHumanReport,
};
