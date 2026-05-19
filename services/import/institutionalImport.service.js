const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { validateExportManifest, verifySectionHashes } = require('../../shared/portability/exportManifest.cjs');
const { hashContent } = require('../../shared/portability/exportUtils.cjs');
const { SECTION_ORDER, resolveSectionNames } = require('../../shared/portability/sectionRegistry.cjs');
const { verifyBackupCompatibility } = require('../backup/backupManifest.service');
const { IdRemapper } = require('./idRemapper');
const {
  checkFrozenSnapshotConflict,
  checkTranscriptSnapshotConflict,
  checkLifecycleConflict,
} = require('./importGuards');

const IMPORT_STAGES = [
  'systemSettings',
  'users',
  'courses',
  'enrollments',
  'modules',
  'pages',
  'assignments',
  'submissions',
  'quizzes',
  'discussions',
  'announcements',
  'polls',
  'groups',
  'groupSets',
  'meetings',
  'attendance',
  'institutionPolicies',
  'coursePolicies',
  'gradeSnapshots',
  'transcriptSnapshots',
  'lifecycleRecords',
  'amendments',
  'policyAudits',
  'systemAudit',
  'asyncJobs',
  'notifications',
  'notificationPreferences',
  'calendarEvents',
  'permissionsRoles',
];

const MODEL_BY_SECTION = {
  systemSettings: '../../models/systemSettings.model',
  users: '../../models/user.model',
  courses: '../../models/course.model',
  modules: '../../models/module.model',
  pages: '../../models/page.model',
  assignments: '../../models/Assignment',
  submissions: '../../models/Submission',
  discussions: '../../models/thread.model',
  announcements: '../../models/announcement.model',
  polls: '../../models/poll.model',
  groups: '../../models/Group',
  groupSets: '../../models/GroupSet',
  meetings: '../../models/groupMeeting.model',
  attendance: '../../models/attendance.model',
  institutionPolicies: '../../models/institutionGradingPolicy.model',
  coursePolicies: '../../models/courseGradingPolicy.model',
  gradeSnapshots: '../../models/studentCourseGradeSnapshot.model',
  transcriptSnapshots: '../../models/transcriptIssueLog.model',
  lifecycleRecords: '../../models/courseGradeLifecycle.model',
  amendments: '../../models/gradeAmendmentRecord.model',
  policyAudits: '../../models/gradingPolicyAudit.model',
  systemAudit: '../../models/systemAuditEvent.model',
  asyncJobs: '../../models/asyncJob.model',
  notifications: '../../models/notification.model',
  notificationPreferences: '../../models/notificationPreferences.model',
  calendarEvents: '../../models/event.model',
};

const REF_FIELDS = {
  users: [],
  courses: ['instructor', 'students', 'tas'],
  modules: ['course'],
  pages: ['course', 'module'],
  assignments: ['module', 'course'],
  submissions: ['assignment', 'student', 'course'],
  discussions: ['course', 'author'],
  gradeSnapshots: ['student', 'course'],
  transcriptSnapshots: ['student', 'course'],
  lifecycleRecords: ['course'],
  amendments: ['course', 'student', 'snapshot'],
};

function loadManifest(exportDir) {
  const manifestPath = path.join(exportDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('manifest.json not found');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function loadSectionFiles(exportDir, section) {
  const files = section.files || [section.file].filter(Boolean);
  const records = [];
  for (const file of files) {
    const filePath = path.join(exportDir, file);
    if (!fs.existsSync(filePath)) throw new Error(`missing section file: ${file}`);
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) records.push(...parsed);
    else records.push(parsed);
  }
  return records;
}

function validateBundleIntegrity(exportDir, manifest) {
  const manifestValidation = validateExportManifest(manifest);
  const issues = [...manifestValidation.errors];
  const hashByFile = {};

  for (const section of manifest.sections || []) {
    const files = section.files || [section.file].filter(Boolean);
    for (const file of files) {
      const filePath = path.join(exportDir, file);
      if (!fs.existsSync(filePath)) {
        issues.push(`missing file: ${file}`);
        continue;
      }
      hashByFile[file] = hashContent(fs.readFileSync(filePath, 'utf8'));
    }
  }

  const hashCheck = verifySectionHashes(manifest, hashByFile);
  issues.push(...hashCheck.issues);

  const compat = verifyBackupCompatibility(manifest);
  if (!compat.compatible) issues.push(...compat.issues);

  return { valid: issues.length === 0, issues, hashByFile };
}

async function upsertDocuments(Model, docs, options, sectionName, remapper, report) {
  for (const raw of docs) {
    let doc = { ...raw };
    if (options.remapIds) doc = remapper.remapDoc(doc, REF_FIELDS[sectionName] || []);

    const existing = doc._id ? await Model.findById(doc._id).lean() : null;

    if (sectionName === 'gradeSnapshots' && doc.frozen) {
      const guard = await checkFrozenSnapshotConflict(doc, options.mode);
      if (guard.conflict) report.conflicts.push({ section: sectionName, ...guard.conflict });
      if (guard.action === 'skip') {
        report.skipped += 1;
        continue;
      }
    }

    if (sectionName === 'transcriptSnapshots') {
      const guard = await checkTranscriptSnapshotConflict(doc);
      if (guard.conflict) report.conflicts.push({ section: sectionName, ...guard.conflict });
      if (guard.action === 'skip') {
        report.skipped += 1;
        continue;
      }
    }

    if (sectionName === 'lifecycleRecords') {
      const guard = await checkLifecycleConflict(doc);
      if (guard.conflict) report.conflicts.push({ section: sectionName, ...guard.conflict });
      if (guard.action === 'skip') {
        report.skipped += 1;
        continue;
      }
    }

    if (existing) {
      if (options.mode === 'skip-existing' || options.skipExisting) {
        report.skipped += 1;
        continue;
      }
      if (options.mode === 'merge') {
        report.updated += 1;
        if (!options.dryRun && !options.validateOnly) {
          await Model.updateOne({ _id: doc._id }, { $set: doc }, { runValidators: false });
        }
        continue;
      }
      report.conflicts.push({ section: sectionName, type: 'duplicate_id', id: String(doc._id) });
      continue;
    }

    report.inserted += 1;
    if (!options.dryRun && !options.validateOnly) {
      await Model.create(doc);
    }
  }
}

async function importSection(sectionName, exportDir, manifestSection, options, remapper, report) {
  const flat = loadSectionFiles(exportDir, manifestSection);

  if (sectionName === 'enrollments') {
    if (options.dryRun || options.validateOnly) {
      report.validated += flat.length;
      return;
    }
    const Course = require('../../models/course.model');
    for (const row of flat) {
      const courseId = remapper.lookup(row.courseId);
      await Course.updateOne(
        { _id: courseId },
        { $set: { students: row.studentIds?.map((id) => remapper.lookup(id)) || [] } }
      );
      report.updated += 1;
    }
    return;
  }

  if (sectionName === 'quizzes') {
    const payload = flat[0];
    if (!payload?.quizzes) return;
    const { QuizWave, QuizSession, QuizResponse } = require('../../models/quizwave.model');
    if (!options.dryRun && !options.validateOnly) {
      for (const q of payload.quizzes || []) {
        const doc = remapper.remapDoc(q, ['course']);
        if (!(await QuizWave.findById(doc._id))) await QuizWave.create(doc);
        else report.skipped += 1;
      }
      for (const s of payload.sessions || []) {
        const doc = remapper.remapDoc(s, ['quiz', 'course']);
        if (!(await QuizSession.findById(doc._id))) await QuizSession.create(doc);
        else report.skipped += 1;
      }
      for (const r of payload.responses || []) {
        const doc = remapper.remapDoc(r, ['session', 'student']);
        if (!(await QuizResponse.findById(doc._id))) await QuizResponse.create(doc);
        else report.skipped += 1;
      }
    }
    report.validated += (payload.quizzes?.length || 0) + (payload.sessions?.length || 0);
    return;
  }

  if (sectionName === 'permissionsRoles' || sectionName === 'uploadsMetadata') {
    report.validated += flat.length;
    return;
  }

  const modelPath = MODEL_BY_SECTION[sectionName];
  if (!modelPath) return;
  const Model = require(modelPath);

  const docs = Array.isArray(flat[0]) ? flat.flat() : flat;
  await upsertDocuments(Model, docs, options, sectionName, remapper, report);
}

/**
 * Restore institution bundle with rollback-safe staged import.
 */
async function restoreInstitutionBundle(exportDir, options = {}) {
  const manifest = loadManifest(exportDir);
  const integrity = validateBundleIntegrity(exportDir, manifest);

  const report = {
    ok: false,
    dryRun: Boolean(options.dryRun),
    validateOnly: Boolean(options.validateOnly),
    mode: options.mode || (options.merge ? 'merge' : options.skipExisting ? 'skip-existing' : 'skip-existing'),
    remapIds: Boolean(options.remapIds),
    inserted: 0,
    updated: 0,
    skipped: 0,
    validated: 0,
    conflicts: [],
    integrity,
    stages: [],
  };

  if (!integrity.valid) {
    report.ok = false;
    return report;
  }

  const remapper = new IdRemapper(options.remapIds);
  const sectionNames = resolveSectionNames(
    options.sections || IMPORT_STAGES.filter((s) => manifest.sections?.some((m) => m.name === s))
  );

  const ordered = IMPORT_STAGES.filter((s) => sectionNames.includes(s));
  const session = !options.dryRun && !options.validateOnly ? await mongoose.startSession() : null;

  try {
    if (session) session.startTransaction();

    for (const sectionName of ordered) {
      const manifestSection = manifest.sections.find((s) => s.name === sectionName);
      if (!manifestSection) continue;

      const stageReport = { section: sectionName, inserted: 0, updated: 0, skipped: 0 };
      const before = { ...report };
      await importSection(sectionName, exportDir, manifestSection, options, remapper, report);
      stageReport.inserted = report.inserted - before.inserted;
      stageReport.updated = report.updated - before.updated;
      stageReport.skipped = report.skipped - before.skipped;
      report.stages.push(stageReport);
    }

    if (session) await session.commitTransaction();
    report.ok = report.conflicts.length === 0 || options.allowConflicts;
    report.idMap = remapper.toJSON();
  } catch (err) {
    if (session) await session.abortTransaction();
    report.ok = false;
    report.error = err.message;
    throw err;
  } finally {
    if (session) session.endSession();
  }

  return report;
}

module.exports = {
  restoreInstitutionBundle,
  validateBundleIntegrity,
  loadManifest,
  IMPORT_STAGES,
};
