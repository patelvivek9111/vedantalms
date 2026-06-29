'use strict';

const Thread = require('../models/thread.model');
const Assignment = require('../models/Assignment');
const Module = require('../models/module.model');
const { COURSE_CODE, COURSE_TITLE } = require('./demoData/grade8MathIndiaConstants');
const { writeE2eEnvLocal } = require('./writeE2eEnvLocal');

const RATIONAL_THREAD_TITLE = 'Discussion: Rational Numbers';
const RATIONAL_QUIZ_TITLE = 'Quiz — Rational Numbers';

/**
 * Write stable Grade 8 math demo IDs for Playwright (e2e/.env.local).
 * @param {import('mongoose').Types.ObjectId | string} courseId
 */
async function persistMathE2eIds(courseId) {
  const courseIdStr = String(courseId);

  const rationalThread = await Thread.findOne({
    course: courseId,
    title: RATIONAL_THREAD_TITLE,
  })
    .select('_id')
    .lean();

  const modules = await Module.find({ course: courseId }).select('_id').lean();
  const moduleIds = modules.map((m) => m._id);
  const rationalQuiz = moduleIds.length
    ? await Assignment.findOne({
        module: { $in: moduleIds },
        title: RATIONAL_QUIZ_TITLE,
        isGradedQuiz: true,
      })
        .select('_id')
        .lean()
    : null;

  const updates = {
    E2E_MATH_COURSE_CODE: COURSE_CODE,
    E2E_MATH_COURSE_ID: courseIdStr,
  };
  if (rationalThread?._id) {
    updates.E2E_RATIONAL_THREAD_ID = String(rationalThread._id);
  }
  if (rationalQuiz?._id) {
    updates.E2E_SEEDED_QUIZ_ID = String(rationalQuiz._id);
  }

  const envFile = writeE2eEnvLocal(updates);
  console.log('[seed] Wrote E2E math IDs to', envFile, {
    courseCode: COURSE_CODE,
    courseId: courseIdStr,
    rationalThreadId: updates.E2E_RATIONAL_THREAD_ID || '(not found)',
    seededQuizId: updates.E2E_SEEDED_QUIZ_ID || '(not found)',
  });
  return updates;
}

module.exports = {
  COURSE_CODE,
  COURSE_TITLE,
  RATIONAL_THREAD_TITLE,
  RATIONAL_QUIZ_TITLE,
  persistMathE2eIds,
};
