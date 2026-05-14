'use strict';

/**
 * Patch existing DEMO-MATH8-IN-2026 grades to look more realistic in Gradebook.
 * - Updates actual numeric grades in:
 *   - regular submissions (homework + quiz assignments)
 *   - group assignment submissions
 *   - graded discussion threads (thread.studentGrades)
 * - Uses deterministic "performance profiles" (fractions) per student name.
 *
 * Usage:
 *   node scripts/patchGrade8Math8DemoGradebookBetter.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const Course = require('../models/course.model');
const Module = require('../models/module.model');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Thread = require('../models/thread.model');
const GroupSet = require('../models/GroupSet');
const Group = require('../models/Group');
const User = require('../models/user.model');

const { COURSE_CODE } = require('./demoData/grade8MathIndiaConstants');
const {
  allocateQuestionGrades,
} = require('./demoData/seedDemoHelpers');

const TEACHER_EMAIL = 'teacher@vidyalms.com';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function sumMapValues(map) {
  if (!map) return 0;
  let s = 0;
  if (map instanceof Map) {
    for (const v of map.values()) s += Number(v) || 0;
    return s;
  }
  if (typeof map === 'object') {
    for (const k of Object.keys(map)) s += Number(map[k]) || 0;
    return s;
  }
  return 0;
}

function findMaxPoints(assignment) {
  if (Array.isArray(assignment.questions) && assignment.questions.length > 0) {
    const sum = assignment.questions.reduce((acc, q) => acc + (Number(q.points) || 0), 0);
    if (sum > 0) return sum;
  }
  return Number(assignment.totalPoints) || 0;
}

function buildQuizAnswersFromQuestionGrades(assignment, questionGradesMap) {
  // submission.answers is a Map-like structure where keys are question index strings.
  const answers = {};
  const qGrades = questionGradesMap instanceof Map ? questionGradesMap : new Map(Object.entries(questionGradesMap || {}));

  assignment.questions.forEach((q, i) => {
    const earned = qGrades.get(String(i)) || 0;
    if (q.type === 'multiple-choice') {
      const correct = q.options?.find((o) => o.isCorrect);
      const wrong = q.options?.find((o) => !o.isCorrect);
      answers[String(i)] = earned > 0
        ? correct?.text || (q.options?.[0]?.text ?? '')
        : wrong?.text || (q.options?.[0]?.text ?? '');
    } else if (q.type === 'matching') {
      // Not used in the demo quizzes; keep generic JSON if present.
      answers[String(i)] = earned > 0 ? '{}' : '{}';
    } else {
      // text questions: provide generic (but non-lorem) worked response
      answers[String(i)] = 'Worked solution written with clear steps.';
    }
  });

  return answers;
}

function buildTextHomeworkAnswers(assignment) {
  const answers = {};
  assignment.questions.forEach((q, i) => {
    if (q.type === 'text') {
      answers[String(i)] = 'Answered with step-by-step reasoning and a clear final result.';
    } else {
      answers[String(i)] = 'Answered with the required working.';
    }
  });
  return answers;
}

function threadHasAnyReply(thread, studentId) {
  const replies = Array.isArray(thread?.replies) ? thread.replies : [];
  const stack = [...replies];
  while (stack.length) {
    const r = stack.pop();
    if (!r) continue;
    const authorId = r.author && typeof r.author === 'object' && r.author._id ? String(r.author._id) : String(r.author || '');
    if (authorId === String(studentId)) return true;
    if (Array.isArray(r.replies) && r.replies.length > 0) stack.push(...r.replies);
  }
  return false;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('[patch-gradebook] MONGODB_URI required');
    process.exit(1);
  }

  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGO_DB_NAME || 'lms',
    serverSelectionTimeoutMS: 15000,
  });

  const teacher = await User.findOne({ email: TEACHER_EMAIL.toLowerCase() });
  if (!teacher) {
    console.error('[patch-gradebook] Teacher not found');
    process.exit(1);
  }

  const course = await Course.findOne({ 'catalog.courseCode': COURSE_CODE });
  if (!course) {
    console.error(`[patch-gradebook] No course found for code ${COURSE_CODE}`);
    return;
  }

  const students = await User.find({ _id: { $in: course.students || [] }, role: 'student' }).lean();
  if (!students || students.length === 0) {
    console.error('[patch-gradebook] No students found in course');
    return;
  }

  // Deterministic performance profiles by current demo roster.
  // Produces: some A/B/C/D/F.
  const fractionByName = new Map([
    ['Arjun', 0.97],
    ['Priya', 0.88],
    ['Riya', 0.83],
    ['Kabir', 0.78],
    ['Ananya', 0.65],
    ['Vikram', 0.55],
  ]);

  const targetFraction = (student) => {
    const f = fractionByName.get(student.firstName);
    if (typeof f === 'number') return clamp(f, 0.05, 0.99);
    // fallback: moderate performance if roster differs
    return 0.72;
  };

  const modules = await Module.find({ course: course._id }).lean();
  const moduleIds = modules.map((m) => m._id);

  // Regular module assignments
  const regularAssignments = await Assignment.find({
    module: { $in: moduleIds },
    isGroupAssignment: { $ne: true },
    published: true,
  }).lean();

  // Group assignments
  const groupSets = await GroupSet.find({ course: course._id }).lean();
  const groupSetIds = groupSets.map((gs) => gs._id);

  const groupAssignments = await Assignment.find({
    isGroupAssignment: true,
    groupSet: { $in: groupSetIds },
    published: true,
  }).lean();

  // 1) Update graded discussions
  const gradedThreads = await Thread.find({ course: course._id, isGraded: true, published: true }).lean();
  for (const thread of gradedThreads) {
    const totalPoints = Number(thread.totalPoints) || 0;
    if (!totalPoints) continue;

    const nextGrades = students.map((st) => {
      const f = targetFraction(st);
      const grade = Math.round(totalPoints * f);
      return {
        student: st._id,
        grade: clamp(grade, 0, totalPoints),
        feedback: 'Solid participation with clear mathematical reasoning.',
        gradedAt: new Date(),
        gradedBy: teacher._id,
      };
    });

    await Thread.updateOne({ _id: thread._id }, { $set: { studentGrades: nextGrades } });
  }

  // 2) Update regular assignment submissions
  for (const assignment of regularAssignments) {
    const maxPoints = findMaxPoints(assignment);
    if (!maxPoints) continue;

    const isQuiz = !!assignment.isGradedQuiz || (assignment.questions || []).some((q) => q.type === 'multiple-choice' || q.type === 'true-false');

    for (const st of students) {
      const f = targetFraction(st);
      const targetTotal = Math.round(maxPoints * f);
      const qGrades = allocateQuestionGrades(targetTotal, assignment.questions || []);
      const earned = sumMapValues(qGrades);

      const existing = await Submission.findOne({
        assignment: assignment._id,
        student: st._id,
      });

      const submittedAt = existing?.submittedAt || new Date();
      const gradedAt = new Date();

      if (existing) {
        existing.grade = earned;
        existing.finalGrade = earned;
        existing.teacherApproved = true;
        existing.gradedBy = teacher._id;
        existing.gradedAt = gradedAt;

        if (isQuiz) {
          existing.autoGraded = true;
          existing.autoGrade = earned;
          existing.autoQuestionGrades = qGrades;
          existing.questionGrades = qGrades;
          existing.answers = buildQuizAnswersFromQuestionGrades(assignment, qGrades);
        } else {
          existing.questionGrades = qGrades;
          existing.answers = buildTextHomeworkAnswers(assignment);
        }
        await existing.save();
      } else {
        const base = {
          assignment: assignment._id,
          student: st._id,
          submittedBy: st._id,
          submittedAt,
          teacherApproved: true,
          gradedBy: teacher._id,
          gradedAt,
          grade: earned,
          finalGrade: earned,
        };

        if (isQuiz) {
          base.autoGraded = true;
          base.autoGrade = earned;
          base.autoQuestionGrades = qGrades;
          base.questionGrades = qGrades;
          base.answers = buildQuizAnswersFromQuestionGrades(assignment, qGrades);
        } else {
          base.questionGrades = qGrades;
          base.answers = buildTextHomeworkAnswers(assignment);
        }

        await Submission.create(base);
      }
    }
  }

  // 3) Update group assignment submissions (one per group)
  for (const groupAssignment of groupAssignments) {
    const maxPoints = findMaxPoints(groupAssignment);
    if (!maxPoints) continue;

    const allGroups = await Group.find({
      groupSet: groupAssignment.groupSet,
      course: course._id,
    }).lean();

    const groupQuestions = groupAssignment.questions || [];

    for (const grp of allGroups) {
      // Use average target fraction across the group members in this course.
      const members = grp.members || [];
      const memberStudents = students.filter((st) => members.map(String).includes(String(st._id)));
      if (memberStudents.length === 0) continue;

      const avgF =
        memberStudents.reduce((acc, st) => acc + targetFraction(st), 0) / memberStudents.length;
      const targetTotal = Math.round(maxPoints * avgF);
      const qGrades = allocateQuestionGrades(targetTotal, groupQuestions);
      const earned = sumMapValues(qGrades);

      const existing = await Submission.findOne({
        assignment: groupAssignment._id,
        group: grp._id,
      });

      const submittedAt = existing?.submittedAt || new Date();
      const gradedAt = new Date();
      const member0 = memberStudents[0];

      if (existing) {
        existing.grade = earned;
        existing.finalGrade = earned;
        existing.teacherApproved = true;
        existing.gradedBy = teacher._id;
        existing.gradedAt = gradedAt;
        existing.questionGrades = qGrades;
        existing.answers = buildTextHomeworkAnswers({ questions: groupQuestions });
        await existing.save();
      } else {
        await Submission.create({
          assignment: groupAssignment._id,
          student: member0._id,
          group: grp._id,
          submittedBy: member0._id,
          submittedAt,
          teacherApproved: true,
          gradedBy: teacher._id,
          gradedAt,
          grade: earned,
          finalGrade: earned,
          questionGrades: qGrades,
          answers: buildTextHomeworkAnswers({ questions: groupQuestions }),
          useIndividualGrades: false,
        });
      }
    }
  }

  console.log('[patch-gradebook] Completed for', COURSE_CODE);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error('[patch-gradebook] Failed:', e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

