#!/usr/bin/env node
/**
 * Mongo explain audit for major LMS collections.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Thread = require('../../models/thread.model');
const Course = require('../../models/course.model');
const Assignment = require('../../models/Assignment');
const Submission = require('../../models/Submission');
const Notification = require('../../models/notification.model');
const DiscussionReply = require('../../models/discussionReply.model');
const Module = require('../../models/module.model');
const { connectMongo, readFixture, explainQuery, writePerfReport } = require('./scalabilityBenchCommon');

async function main() {
  await connectMongo();
  const fixture = readFixture();
  const courseOid = new mongoose.Types.ObjectId(fixture.course.id);
  const studentOid = new mongoose.Types.ObjectId(fixture.students[0].id);

  const queries = [];

  queries.push(
    await explainQuery(Course, { students: studentOid, published: true }, { updatedAt: -1 })
  );
  queries.push(
    await explainQuery(Thread, { course: courseOid, deletedAt: null }, { lastActivity: -1 })
  );

  const modules = await Module.find({ course: courseOid }).select('_id').lean();
  const moduleIds = modules.map((m) => m._id);
  if (moduleIds.length) {
    queries.push(
      await explainQuery(Assignment, { module: { $in: moduleIds } }, { dueDate: 1 })
    );
  }

  queries.push(
    await explainQuery(Submission, { student: studentOid }, { updatedAt: -1 })
  );
  queries.push(
    await explainQuery(Notification, { userId: studentOid, read: false }, { createdAt: -1 })
  );
  queries.push(
    await explainQuery(
      DiscussionReply,
      { threadId: { $exists: true }, authorId: studentOid, deletedAt: null },
      {}
    )
  );

  const report = {
    benchmark: 'mongo-explain-audit',
    generatedAt: new Date().toISOString(),
    queries,
    recommendations: queries.map((q) => ({
      collection: q.collection,
      indexUsed: q.indexUsed || '(none / COLLSCAN)',
      docsExamined: q.totalDocsExamined,
      keysExamined: q.totalKeysExamined,
      executionTimeMillis: q.executionTimeMillis,
      suggestedIndex:
        q.collection === 'threads' && !q.indexUsed
          ? '{ course: 1, deletedAt: 1, lastActivity: -1 }'
          : q.collection === 'courses' && q.stage === 'COLLSCAN'
            ? '{ students: 1, published: 1 }'
            : null,
    })),
  };

  const out = writePerfReport('mongo-explain-audit-latest.json', report);
  console.log(JSON.stringify({ ok: true, report: out, queries }, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
