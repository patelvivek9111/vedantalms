#!/usr/bin/env node
/**
 * P3-8 Quarterly infra tier review helper — enrollment-based right-sizing checklist.
 * Usage: node scripts/ops/infraTierReview.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');

const TIERS = [
  {
    name: 'starter',
    maxEnrolled: 500,
    atlas: 'M10 shared',
    apiInstances: 1,
    redis: '256MB',
    workers: ['grading'],
  },
  {
    name: 'growth',
    maxEnrolled: 2500,
    atlas: 'M20 dedicated',
    apiInstances: 2,
    redis: '1GB',
    workers: ['grading', 'notification-fanout', 'file-scan'],
  },
  {
    name: 'scale',
    maxEnrolled: 10000,
    atlas: 'M30+ sharded discussions/notifications',
    apiInstances: 3,
    redis: '2GB+',
    workers: ['grading', 'notification-fanout', 'file-scan', 'nightly-ops'],
  },
];

function pickTier(enrolledStudents) {
  return TIERS.find((tier) => enrolledStudents <= tier.maxEnrolled) || TIERS[TIERS.length - 1];
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const [studentCount, courseCount, activeCourses] = await Promise.all([
    User.countDocuments({ role: 'student' }),
    Course.countDocuments({}),
    Course.countDocuments({ published: true, operationalStatus: { $ne: 'archived' } }),
  ]);

  const enrollmentRows = await Course.aggregate([
    { $project: { studentCount: { $size: { $ifNull: ['$students', []] } } } },
    { $group: { _id: null, totalEnrolled: { $sum: '$studentCount' } } },
  ]);
  const totalEnrolled = enrollmentRows[0]?.totalEnrolled || 0;
  const tier = pickTier(totalEnrolled);

  const checklist = [
    'Review Atlas CPU/IO charts for discussion + notification collections',
    'Review Cloudinary storage + bandwidth dashboard (P3-4)',
    'Confirm Redis memory usage and eviction policy',
    'Verify worker processes running for tier-required queues',
    'Run npm run verify:file-orphans:ci against production snapshot',
    'Compare /health/ops pollPerHour vs websocket connections',
    'Re-run capacity load test if enrollment grew >25% since last test',
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    counts: {
      students: studentCount,
      courses: courseCount,
      activePublishedCourses: activeCourses,
      totalEnrolledSeats: totalEnrolled,
    },
    recommendedTier: tier,
    checklist,
    envFlags: {
      REQUIRE_REDIS: process.env.REQUIRE_REDIS === 'true',
      NOTIFICATION_WEBSOCKET_ENABLED: process.env.NOTIFICATION_WEBSOCKET_ENABLED === 'true',
      INBOX_WEBSOCKET_ENABLED: process.env.INBOX_WEBSOCKET_ENABLED === 'true',
      NOTIFICATION_FANOUT_QUEUE_ENABLED: process.env.NOTIFICATION_FANOUT_QUEUE_ENABLED !== 'false',
    },
  };

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
