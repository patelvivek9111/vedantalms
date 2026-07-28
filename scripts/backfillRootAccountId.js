/**
 * Phase 1 tenancy backfill:
 * - Ensure example/default root Account + domains
 * - Assign rootAccountId on core + registrar collections still missing tenancy
 *
 * Usage: node scripts/backfillRootAccountId.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { ensureDefaultRootAccount } = require('../services/tenancy/ensureDefaultRootAccount.service');

async function dropLegacyEmailUniqueIndex() {
  try {
    const indexes = await mongoose.connection.collection('users').indexes();
    const emailUnique = indexes.find(
      (idx) => idx.unique && idx.key && Object.keys(idx.key).length === 1 && idx.key.email === 1
    );
    if (emailUnique) {
      await mongoose.connection.collection('users').dropIndex(emailUnique.name);
      console.log(`Dropped legacy index ${emailUnique.name}`);
    }
  } catch (err) {
    if (err.codeName !== 'IndexNotFound') {
      console.warn('dropLegacyEmailUniqueIndex:', err.message);
    }
  }

  try {
    const indexes = await mongoose.connection.collection('institutiongradingpolicies').indexes();
    const keyUnique = indexes.find(
      (idx) => idx.unique && idx.key && Object.keys(idx.key).length === 1 && idx.key.key === 1
    );
    if (keyUnique) {
      await mongoose.connection.collection('institutiongradingpolicies').dropIndex(keyUnique.name);
      console.log(`Dropped legacy index ${keyUnique.name}`);
    }
  } catch (err) {
    if (err.codeName !== 'IndexNotFound') {
      console.warn('dropLegacyPolicyKeyIndex:', err.message);
    }
  }
}

async function backfillCollection(modelName, rootId) {
  try {
    const Model = mongoose.model(modelName);
    const filter = {
      $or: [{ rootAccountId: null }, { rootAccountId: { $exists: false } }],
    };
    const result = await Model.updateMany(filter, {
      $set: { rootAccountId: rootId, accountId: rootId },
    });
    console.log(
      `${modelName}: matched=${result.matchedCount ?? result.n} modified=${result.modifiedCount ?? result.nModified}`
    );
  } catch (err) {
    console.warn(`${modelName}: skip (${err.message})`);
  }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(uri);
  console.log('Connected');

  await dropLegacyEmailUniqueIndex();

  const root = await ensureDefaultRootAccount();
  console.log(`Example/default root account "${root.name}" code=${root.code} id=${root._id}`);

  // Register models used by backfill
  const modelFiles = [
    'user.model',
    'course.model',
    'fileAsset.model',
    'systemSettings.model',
    'institutionGradingPolicy.model',
    'enrollment.model',
    'academicTerm.model',
    'program.model',
    'courseOffering.model',
    'courseSection.model',
    'crossListGroup.model',
    'studentHold.model',
    'courseGradeLifecycle.model',
    'transcriptIssueLog.model',
    'transcriptTemplate.model',
    'sisJob.model',
    'sisStagingEnrollment.model',
    'sisSyncBatch.model',
    'sisSyncRow.model',
    'sisIntegrationConfig.model',
    'gradePassbackRecord.model',
    'asyncJob.model',
    'systemAuditEvent.model',
    'institutionGradingPeriod.model',
  ];
  for (const f of modelFiles) {
    try {
      require(`../models/${f}`);
    } catch (err) {
      console.warn(`require ${f}: ${err.message}`);
    }
  }

  const names = [
    'User',
    'Course',
    'FileAsset',
    'SystemSettings',
    'InstitutionGradingPolicy',
    'Enrollment',
    'AcademicTerm',
    'Program',
    'CourseOffering',
    'CourseSection',
    'CrossListGroup',
    'StudentHold',
    'CourseGradeLifecycle',
    'TranscriptIssueLog',
    'TranscriptTemplate',
    'SisJob',
    'SisStagingEnrollment',
    'SisSyncBatch',
    'SisSyncRow',
    'SisIntegrationConfig',
    'GradePassbackRecord',
    'AsyncJob',
    'SystemAuditEvent',
    'InstitutionGradingPeriod',
  ];

  for (const name of names) {
    await backfillCollection(name, root._id);
  }

  // Course-child rows (threads, submissions) pick up tenancy from Course via plugin / separate script:
  // node scripts/backfillCourseChildRootAccountId.js

  const FileAsset = mongoose.model('FileAsset');
  await FileAsset.updateMany(
    { rootAccountId: root._id },
    { $set: { institutionId: String(root._id) } }
  );

  console.log('Backfill complete — existing data belongs to this example institution.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
