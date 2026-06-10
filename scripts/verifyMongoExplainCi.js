#!/usr/bin/env node
/**
 * P3-3 CI gate: fail when hot-path Mongo queries COLLSCAN or exceed doc examine thresholds.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Thread = require('../models/thread.model');
const Course = require('../models/course.model');
const Notification = require('../models/notification.model');
const { explainQuery } = require('./perf/scalabilityBenchCommon');

function readInt(name, fallback) {
  const parsed = parseInt(process.env[name] || String(fallback), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('verify:mongo-explain:ci SKIP — MONGODB_URI not configured');
    process.exit(0);
  }

  await mongoose.connect(uri);
  const sampleCourse = await Course.findOne({ published: true }).select('_id students').lean();
  const sampleStudent = sampleCourse?.students?.[0] || null;

  if (!sampleCourse || !sampleStudent) {
    console.log('verify:mongo-explain:ci SKIP — no published course with students');
    await mongoose.disconnect();
    process.exit(0);
  }

  const courseOid = sampleCourse._id;
  const studentOid = sampleStudent;

  const checks = [];
  checks.push(
    await explainQuery(Course, { students: studentOid, published: true }, { updatedAt: -1 })
  );
  checks.push(
    await explainQuery(Thread, { course: courseOid, deletedAt: null }, { lastActivity: -1 })
  );
  checks.push(
    await explainQuery(Notification, { user: studentOid, read: false }, { createdAt: -1 })
  );

  await mongoose.disconnect();

  const maxDocsExamined = readInt('CI_MONGO_MAX_DOCS_EXAMINED', 5000);
  const violations = [];

  for (const row of checks) {
    const collscan = row.stage === 'COLLSCAN' || row.indexUsed === '(none / COLLSCAN)';
    if (collscan) {
      violations.push(`${row.collection}: COLLSCAN on hot path`);
    }
    if ((row.totalDocsExamined || 0) > maxDocsExamined) {
      violations.push(
        `${row.collection}: docsExamined ${row.totalDocsExamined} > ${maxDocsExamined}`
      );
    }
  }

  const payload = {
    ok: violations.length === 0,
    thresholds: { maxDocsExamined },
    checks,
    violations,
  };

  console.log(JSON.stringify(payload, null, 2));

  if (violations.length) {
    console.error('verify:mongo-explain:ci FAILED');
    process.exit(1);
  }

  console.log('verify:mongo-explain:ci OK');
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
