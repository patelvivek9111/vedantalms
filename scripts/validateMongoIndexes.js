#!/usr/bin/env node
/**
 * Wave E: validate expected MongoDB indexes for grading / audit collections.
 * Usage: node scripts/validateMongoIndexes.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const EXPECTED = [
  {
    model: 'CourseGradeLifecycle',
    path: '../models/courseGradeLifecycle.model',
    indexes: [{ keys: { course: 1, term: 1, year: 1 }, unique: true }],
  },
  {
    model: 'StudentCourseGradeSnapshot',
    path: '../models/studentCourseGradeSnapshot.model',
    indexes: [{ keys: { student: 1, course: 1, term: 1, year: 1, isCurrent: 1 } }],
  },
  {
    model: 'SystemAuditEvent',
    path: '../models/systemAuditEvent.model',
    indexes: [
      { keys: { entityType: 1, entityId: 1, createdAt: -1 } },
      { keys: { action: 1, createdAt: -1 } },
    ],
  },
  {
    model: 'AsyncJob',
    path: '../models/asyncJob.model',
    indexes: [{ keys: { status: 1, createdAt: -1 } }],
  },
  {
    model: 'TranscriptIssueLog',
    path: '../models/transcriptIssueLog.model',
    indexes: [{ keys: { student: 1, term: 1, year: 1, createdAt: -1 } }],
  },
  {
    model: 'GradeAmendmentRecord',
    path: '../models/gradeAmendmentRecord.model',
    indexes: [{ keys: { course: 1, term: 1, year: 1, sequence: -1 } }],
  },
  {
    model: 'MigrationRun',
    path: '../models/migrationRun.model',
    indexes: [{ keys: { migrationId: 1 } }],
  },
];

function indexKeySig(keys) {
  return JSON.stringify(keys);
}

function collectionHasIndex(collectionIndexes, expectedKeys) {
  const want = indexKeySig(expectedKeys);
  return collectionIndexes.some((idx) => indexKeySig(idx.key) === want);
}

async function syncModelIndexes(Model, modelName) {
  try {
    await Model.syncIndexes();
  } catch (err) {
    if (err.code === 86 || err.codeName === 'IndexKeySpecsConflict') {
      console.warn(`WARN  ${modelName} syncIndexes index conflict (continuing validation)`);
      return;
    }
    throw err;
  }
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
  const connectOptions = {};
  if (process.env.MONGO_DB_NAME) {
    connectOptions.dbName = process.env.MONGO_DB_NAME;
  }
  await mongoose.connect(uri, connectOptions);
  let failed = 0;

  for (const spec of EXPECTED) {
    const Model = require(spec.path);
    await syncModelIndexes(Model, spec.model);
    const indexes = await Model.collection.indexes();
    for (const exp of spec.indexes) {
      const ok = collectionHasIndex(indexes, exp.keys);
      const label = `${spec.model} ${indexKeySig(exp.keys)}`;
      if (ok) {
        console.log(`OK  ${label}`);
      } else {
        console.error(`MISSING  ${label}`);
        failed += 1;
      }
    }
  }

  await mongoose.disconnect();
  if (failed > 0) {
    console.error(`\n${failed} expected index(es) missing. Run syncIndexes in dev or create migrations.`);
    process.exit(1);
  }
  console.log('\nAll expected grading indexes present.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
