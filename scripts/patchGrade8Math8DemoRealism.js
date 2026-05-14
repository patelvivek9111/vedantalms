'use strict';

/**
 * One-time (re-runnable) patch for an already-seeded DEMO-MATH8-IN-2026 course:
 * - Align questionGrades / autoQuestionGrades with final grades
 * - Majority winner on the revision-time poll
 * - Richer student↔student discussion replies on welcome + module threads
 * - Staggered submission times; 2 missing + 3 late per module assignment pattern
 * - Rename titles: "Problem set — X" → "X — Assignment"; "Quick check — X" → "Quiz — X"
 *
 * Usage: node scripts/patchGrade8Math8DemoRealism.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const Course = require('../models/course.model');
const Module = require('../models/module.model');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Poll = require('../models/poll.model');
const Announcement = require('../models/announcement.model');
const Thread = require('../models/thread.model');
const GroupSet = require('../models/GroupSet');
const User = require('../models/user.model');

const { COURSE_CODE } = require('./demoData/grade8MathIndiaConstants');
const {
  allocateQuestionGrades,
  addHours,
  addMinutes,
  pickMissingAndLate,
  buildMcAutoQuestionGrades,
} = require('./demoData/seedDemoHelpers');

const TEACHER_EMAIL = 'teacher@vidyalms.com';

const oid = () => new mongoose.Types.ObjectId();

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pickDiscussionScore(modIdx, studentIdx) {
  // 6–10 range; deterministic variation across module+student.
  const base = 10 - ((modIdx + studentIdx) % 5); // 10..6
  return clamp(base, 6, 10);
}

function feedbackFor(score) {
  if (score >= 10) return 'Excellent reasoning and a helpful reply to a peer.';
  if (score >= 9) return 'Strong work. Clear steps and good mathematical language.';
  if (score >= 8) return 'Good attempt. Add one explicit justification line next time.';
  if (score >= 7) return 'On track. Improve clarity by stating the property you used.';
  return 'Needs more detail. Include a verification step and respond to a classmate.';
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('[patch] MONGODB_URI required');
    process.exit(1);
  }
  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGO_DB_NAME || 'lms',
    serverSelectionTimeoutMS: 15000,
  });

  const course = await Course.findOne({ 'catalog.courseCode': COURSE_CODE }).populate('students');
  if (!course) {
    console.log(`[patch] No course with code ${COURSE_CODE}.`);
    await mongoose.disconnect();
    return;
  }

  const teacher = await User.findOne({ email: TEACHER_EMAIL.toLowerCase() });
  if (!teacher) {
    console.error('[patch] Teacher not found');
    process.exit(1);
  }

  const students = course.students;
  if (!students || students.length === 0) {
    console.error('[patch] Course has no students populated');
    process.exit(1);
  }

  const modules = await Module.find({ course: course._id }).sort({ createdAt: 1 });
  const moduleIndexById = new Map();
  modules.forEach((m, i) => moduleIndexById.set(String(m._id), i));

  const moduleIds = modules.map((m) => m._id);
  const assignments = await Assignment.find({ module: { $in: moduleIds } });

  const groupSets = await GroupSet.find({ course: course._id });
  const groupSetIds = groupSets.map((g) => g._id);
  const groupAssignment = await Assignment.findOne({
    groupSet: { $in: groupSetIds },
    isGroupAssignment: true,
  });

  for (const a of assignments) {
    const modIdx = moduleIndexById.get(String(a.module)) ?? 0;
    const { missing, late } = pickMissingAndLate(modIdx, students.length);
    const missingIds = [...missing].map((si) => students[si]._id);

    await Submission.deleteMany({
      assignment: a._id,
      student: { $in: missingIds },
      group: null,
    });

    const subs = await Submission.find({ assignment: a._id, group: null });
    const fullA = await Assignment.findById(a._id);

    for (const sub of subs) {
      const si = students.findIndex((s) => String(s._id) === String(sub.student));
      if (si < 0) continue;

      if (fullA.isGradedQuiz && fullA.questions?.length) {
        const autoQ = buildMcAutoQuestionGrades(fullA.questions, sub.answers);
        let earned = 0;
        autoQ.forEach((v) => {
          earned += v;
        });
        let submittedAt;
        if (late.has(si)) {
          submittedAt = addHours(addDays(fullA.dueDate, 1 + (si % 2)), 15 + si * 2);
        } else {
          submittedAt = addMinutes(
            addHours(addDays(fullA.availableFrom, 2 + (si % 4)), 16 + si),
            20 + si * 11
          );
        }
        sub.autoQuestionGrades = autoQ;
        sub.autoGraded = true;
        sub.autoGrade = earned;
        sub.grade = earned;
        sub.finalGrade = earned;
        sub.submittedAt = submittedAt;
        sub.gradedAt = addHours(submittedAt, 8 + (si % 5));
        sub.gradedBy = teacher._id;
        sub.teacherApproved = true;
      } else if (fullA.isOfflineAssignment || (fullA.questions || []).some((q) => q.type === 'text')) {
        const g = typeof sub.finalGrade === 'number' ? sub.finalGrade : sub.grade;
        if (g == null) continue;
        sub.questionGrades = allocateQuestionGrades(g, fullA.questions || []);
        let submittedAt;
        if (late.has(si)) {
          submittedAt = addHours(addDays(fullA.dueDate, 1 + (si % 3)), 22 + si);
        } else {
          submittedAt = addMinutes(
            addHours(addDays(fullA.availableFrom, 3 + (si % 5)), 17 + si),
            40 + si * 13
          );
        }
        sub.submittedAt = submittedAt;
        sub.gradedAt = addHours(submittedAt, 12 + (si % 7));
        sub.gradedBy = teacher._id;
      }
      await sub.save();
    }
  }

  if (groupAssignment) {
    const gq = groupAssignment.questions || [];
    await Submission.deleteMany({
      assignment: groupAssignment._id,
      group: { $ne: null },
    });

    const groupSetsList = await GroupSet.find({ course: course._id });
    const gsId = groupSetsList[0]?._id;
    const Group = require('../models/Group');
    const groups = await Group.find({ groupSet: gsId }).sort({ name: 1 });
    const g1 = groups[0];
    const g2 = groups[1];
    if (g1) {
      const leader = students[0];
      await Submission.create({
        assignment: groupAssignment._id,
        student: leader._id,
        group: g1._id,
        submittedBy: leader._id,
        submissionText:
          'Poster draft: histogram of commute times with 10-minute bins; insights on peak congestion at 8–9 a.m.',
        answers: { g1: 'Team summary: roles split as data collection, plot, write-up.' },
        submittedAt: addHours(addDays(groupAssignment.dueDate, -4), 19),
        questionGrades: allocateQuestionGrades(26, gq),
        grade: 26,
        finalGrade: 26,
        teacherApproved: true,
        gradedBy: teacher._id,
        gradedAt: addHours(addDays(groupAssignment.dueDate, -3), 10),
        feedback: 'Excellent axis labels; add source citation for raw data.',
      });
    }
    if (g2) {
      const leader = students[2];
      await Submission.create({
        assignment: groupAssignment._id,
        student: leader._id,
        group: g2._id,
        submittedBy: leader._id,
        submissionText:
          'Team B poster: health clinic waiting times; one histogram + dot plot. Still polishing the limitation paragraph.',
        answers: { g1: 'Riya: table; Kabir: plots; joint write-up.' },
        submittedAt: addHours(addDays(groupAssignment.dueDate, 2), 20),
        questionGrades: allocateQuestionGrades(24, gq),
        grade: 24,
        finalGrade: 24,
        teacherApproved: true,
        gradedBy: teacher._id,
        gradedAt: addHours(addDays(groupAssignment.dueDate, 3), 9),
        feedback: 'Late but solid analysis; tighten the axis title on the dot plot.',
      });
    }
  }

  const pollStart = course.catalog?.startDate ? new Date(course.catalog.startDate) : new Date('2026-01-06');
  const revisionVotes = [];
  if (students[0]) revisionVotes.push({ student: students[0]._id, selectedOptions: [1], votedAt: addDays(pollStart, 3) });
  if (students[1]) revisionVotes.push({ student: students[1]._id, selectedOptions: [1], votedAt: addDays(pollStart, 3) });
  if (students[2]) revisionVotes.push({ student: students[2]._id, selectedOptions: [1], votedAt: addDays(pollStart, 4) });
  if (students[3]) revisionVotes.push({ student: students[3]._id, selectedOptions: [1], votedAt: addDays(pollStart, 4) });
  if (students[4]) revisionVotes.push({ student: students[4]._id, selectedOptions: [0], votedAt: addDays(pollStart, 5) });
  if (students[5]) revisionVotes.push({ student: students[5]._id, selectedOptions: [2], votedAt: addDays(pollStart, 5) });

  await Poll.updateMany(
    { course: course._id, title: 'When do you usually revise mathematics?' },
    {
      $set: {
        options: [
          { text: 'Right after school', votes: 1 },
          { text: 'After dinner', votes: 4 },
          { text: 'Weekend mornings', votes: 1 },
          { text: 'Mixed / irregular', votes: 0 },
        ],
        studentVotes: revisionVotes,
      },
    }
  );

  const semStart = course.catalog?.startDate ? new Date(course.catalog.startDate) : new Date('2026-01-06');

  // Welcome thread: students reply to each other (nested), plus a teacher follow-up.
  const w1 = oid();
  const w2 = oid();
  const w3 = oid();
  const w4 = oid();
  const w5 = oid();
  const welcomeReplies = [
    {
      _id: w1,
      author: students[0]._id,
      parentReply: null,
      content: `<p>Hi everyone — Arjun here. I actually enjoy mensuration because it feels like solving little puzzles with real boxes. My goal is to stop rushing the last step of proofs.</p>`,
    },
    {
      _id: w2,
      author: students[1]._id,
      parentReply: w1,
      content: `<p>@${escHtml(students[0].firstName)} do you use grid paper for 3D sketches or plain notebook? I keep mixing up which edges should be hidden in nets.</p>`,
    },
    {
      _id: w3,
      author: students[0]._id,
      parentReply: w2,
      content: `<p>@${escHtml(students[1].firstName)} I use grid paper for nets and rough plain notebook for working. For hidden edges: I lightly draw them first and darken only the visible ones after checking.</p>`,
    },
    {
      _id: w4,
      author: students[2]._id,
      parentReply: w2,
      content: `<p>@${escHtml(students[1].firstName)} same issue here. One trick: label faces with letters before folding in your head. It reduces mistakes.</p>`,
    },
    {
      _id: w5,
      author: teacher._id,
      parentReply: w1,
      content: `<p>Great peer support already. If you’re unsure about nets, post a photo or a small sketch in the Mensuration module — we’ll correct the “hidden edge” convention together.</p>`,
    },
  ];

  await Thread.updateOne(
    { course: course._id, title: 'Welcome — introduce yourself' },
    { $set: { replies: welcomeReplies, lastActivity: addDays(semStart, 2) } }
  );

  const discThreads = await Thread.find({
    course: course._id,
    title: { $regex: /^Discussion:/ },
  }).populate('module');

  for (const t of discThreads) {
    const modIdx = t.module ? moduleIndexById.get(String(t.module._id || t.module)) ?? 0 : 0;
    const a = students[modIdx % students.length];
    const b = students[(modIdx + 2) % students.length];
    const c = students[(modIdx + 4) % students.length];
    // Most modules: a top-level student post, then threaded student replies.
    // Every 4th module: add an extra back-and-forth so the thread feels active (2–3 replies on a post).
    const r1 = oid();
    const r2 = oid();
    const r3 = oid();
    const r4 = oid();
    const r5 = oid();
    const r6 = oid();
    const longThread = modIdx % 4 === 0;

    const replies = [
      {
        _id: r1,
        author: a._id,
        parentReply: null,
        content: `<p>I tried a textbook problem and then changed the numbers slightly. Here is my approach: define the variable, form the equation, transpose, verify. Could someone check if my verification line is enough for marks?</p>`,
      },
      {
        _id: r2,
        author: b._id,
        parentReply: r1,
        content: `<p>@${escHtml(a.firstName)} your steps are clear. Add one line that names the property (like distributive law / transposing) and it should be stronger for the rubric.</p>`,
      },
      ...(longThread
        ? [
            {
              _id: r3,
              author: a._id,
              parentReply: r2,
              content: `<p>@${escHtml(b.firstName)} thanks — I added “subtracting the same term from both sides” as the reason. Is it okay if I write it in one short sentence?</p>`,
            },
            {
              _id: r4,
              author: b._id,
              parentReply: r3,
              content: `<p>Yes, one sentence is fine. Also if it’s a word problem, write the unit in the final line (₹, cm, days).</p>`,
            },
          ]
        : []),
      {
        _id: r5,
        author: c._id,
        parentReply: null,
        content: `<p>Real-life link: my mother compares mobile prepaid packs using percentages and “effective cost per GB.” It is basically comparing quantities from our unit.</p>`,
      },
      {
        _id: r6,
        author: students[(modIdx + 1) % students.length]._id,
        parentReply: r5,
        content: `<p>@${escHtml(c.firstName)} that is a cool example. Do you treat the rollover data as a separate plan or merge it into one table before comparing?</p>`,
      },
      {
        _id: oid(),
        author: teacher._id,
        parentReply: longThread ? r4 : r1,
        content: `<p>Good thread. Keep replying to each other like this — it’s exactly how we improve solutions. I’ll highlight one strong “verification line” example in the next recap.</p>`,
      },
    ];
    await Thread.updateOne(
      { _id: t._id },
      { $set: { replies, lastActivity: addDays(semStart, modIdx * 14 + 8) } }
    );
  }

  // Grade discussions: assign scores to students who participated (replied),
  // leaving one participant ungraded per thread to feel realistic.
  const gradedThreads = await Thread.find({ course: course._id, isGraded: true, published: true });
  for (const thread of gradedThreads) {
    const modIdx = thread.module ? moduleIndexById.get(String(thread.module)) ?? 0 : 0;
    const replies = Array.isArray(thread.replies) ? thread.replies : [];
    const participants = new Set(
      replies
        .map((r) => (r && r.author ? String(r.author) : null))
        .filter(Boolean)
    );

    // Skip a rotating student (if they participated) so not everything is graded.
    const skipIdx = modIdx % students.length;
    const skipStudentId = students[skipIdx]?._id ? String(students[skipIdx]._id) : null;

    const nextGrades = [];
    for (let si = 0; si < students.length; si++) {
      const sid = String(students[si]._id);
      if (!participants.has(sid)) continue;
      if (skipStudentId && sid === skipStudentId) continue;
      const score = pickDiscussionScore(modIdx, si);
      nextGrades.push({
        student: students[si]._id,
        grade: score,
        feedback: feedbackFor(score),
        gradedAt: addDays(semStart, modIdx * 14 + 12),
        gradedBy: teacher._id,
      });
    }

    await Thread.updateOne({ _id: thread._id }, { $set: { studentGrades: nextGrades } });
  }

  const modAssigns = await Assignment.find({ module: { $in: moduleIds } });
  let renamedTitles = 0;
  for (const a of modAssigns) {
    const orig = a.title || '';
    if (orig.startsWith('Problem set — ')) {
      a.title = `${orig.slice('Problem set — '.length).trim()} — Assignment`;
    } else if (orig.startsWith('Quick check — ')) {
      a.title = `Quiz — ${orig.slice('Quick check — '.length).trim()}`;
    }
    if (a.title !== orig) {
      renamedTitles++;
      await a.save();
    }
  }

  const anns = await Announcement.find({ course: course._id });
  for (const ann of anns) {
    if (ann.body && ann.body.includes('Quick check')) {
      ann.body = ann.body.replace(/Quick check/g, 'Quiz');
      await ann.save();
    }
  }

  console.log(
    '[patch] Updated course',
    String(course._id),
    'submissions, poll, threads, assignment titles:',
    renamedTitles
  );
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error('[patch]', e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
