#!/usr/bin/env node
/**
 * Sample historical / edge courses for discussion integrity (archived, oldest, copied heuristic).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Course = require('../models/course.model');
const Thread = require('../models/thread.model');
const DiscussionReply = require('../models/discussionReply.model');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
const strict = process.argv.includes('--strict');
const sample = Math.max(5, parseInt(process.env.DISCUSSION_HISTORICAL_SAMPLE || '15', 10));

async function summarizeCourse(course) {
  const threads = await Thread.find({ course: course._id, deletedAt: null })
    .select('_id counters replies isGraded moderationState')
    .lean();
  let embedded = 0;
  let collectionReplies = 0;
  let graded = 0;
  for (const t of threads) {
    if ((t.replies || []).length) embedded += 1;
    const c = await DiscussionReply.countDocuments({ threadId: t._id, deletedAt: null });
    collectionReplies += c;
    if (t.isGraded) graded += 1;
  }
  return {
    courseId: String(course._id),
    title: course.title || '',
    archived: course.status === 'archived',
    threadCount: threads.length,
    threadsWithEmbedded: embedded,
    activeCollectionReplies: collectionReplies,
    gradedThreads: graded,
  };
}

async function main() {
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });
  const oldest = await Course.find({})
    .sort({ createdAt: 1 })
    .limit(sample)
    .select('_id title status archivedAt createdAt')
    .lean();
  const archived = await Course.find({ status: 'archived' })
    .sort({ updatedAt: -1 })
    .limit(Math.min(sample, 10))
    .select('_id title status')
    .lean();

  const rows = [];
  const seen = new Set();
  for (const c of [...oldest, ...archived]) {
    const id = String(c._id);
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push(await summarizeCourse(c));
  }

  const issues = [];
  for (const r of rows) {
    if (r.threadsWithEmbedded && r.activeCollectionReplies > 0) {
      issues.push({ courseId: r.courseId, issue: 'mixed_embedded_and_collection_in_sample' });
    }
  }

  const report = { generatedAt: new Date().toISOString(), sampledCourses: rows.length, rows, issues };
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  if (strict && issues.length) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
