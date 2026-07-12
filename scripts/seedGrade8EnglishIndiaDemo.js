'use strict';

/**
 * Seeds a full-semester Grade 8 English (Indian / CBSE-style) demo course
 * for teacher@vidyalms.com.
 *
 * Usage:
 *   node scripts/seedGrade8EnglishIndiaDemo.js
 *   node scripts/seedGrade8EnglishIndiaDemo.js --sync-pages
 *
 * Requires: MONGODB_URI, existing teacher user teacher@vidyalms.com.
 * Optional: DEMO_STUDENT_PASSWORD (default VedantaDemo8!) for created demo students.
 * Idempotent: skips if catalog.courseCode DEMO-ENG8-IN-2026 exists (unless --sync-pages).
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const User = require('../models/user.model');
const Course = require('../models/course.model');
const Module = require('../models/module.model');
const Page = require('../models/page.model');
const Assignment = require('../models/Assignment');
const Thread = require('../models/thread.model');
const Announcement = require('../models/announcement.model');
const Poll = require('../models/poll.model');
const { QuizWave, QuizSession } = require('../models/quizwave.model');
const GroupSet = require('../models/GroupSet');
const Group = require('../models/Group');
const GroupMeeting = require('../models/groupMeeting.model');
const Submission = require('../models/Submission');
const Attendance = require('../models/attendance.model');
const Notification = require('../models/notification.model');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const ConversationParticipant = require('../models/ConversationParticipant');

const {
  SEMESTER,
  COURSE_CODE,
  COURSE_TITLE,
  COURSE_DESCRIPTION,
  SYLLABUS_HTML,
  MODULE_SPECS,
} = require('./demoData/grade8EnglishIndiaModules');
const {
  allocateQuestionGrades,
  addHours,
  addMinutes,
  computeMcMatchingQuestionGrades,
} = require('./demoData/seedDemoHelpers');

const TEACHER_EMAIL = 'teacher@vidyalms.com';

/** Must match `course.groups[].name` exactly so the gradebook weighted average uses real categories (not a broken “other” bucket). */
const ASSIGN_GROUP = {
  homework: 'Weekly homework & process writing',
  quiz: 'Quizzes & checkpoint tasks',
  project: 'Projects & presentations',
  discussion: 'Discussions & seminar participation',
  exam: 'Semester examination',
  portfolio: 'Portfolio & reflection',
};

/** Per-student performance tier (0–1) — spread so overall letters range from A range down to F after weighting. */
function perfFraction(studentIndex) {
  const tiers = [0.98, 0.93, 0.88, 0.82, 0.76, 0.7, 0.64, 0.48];
  return tiers[studentIndex % tiers.length];
}

/** Demo-friendly: no missing submissions (missing work was collapsing weighted averages to the F range). */
function noMissingNoLate() {
  return { missing: new Set(), late: new Set() };
}

const syncPagesRequested =
  process.argv.includes('--sync-pages') || process.env.SYNC_GRADE8_ENG8_PAGES === 'true';

async function syncPageContentFromSpecs(courseId) {
  let updated = 0;
  let skipped = 0;
  let missingMod = 0;
  let missingPage = 0;
  let orderFallback = 0;

  for (const spec of MODULE_SPECS) {
    const mod = await Module.findOne({ course: courseId, title: spec.title });
    if (!mod) {
      console.warn(`[sync] No module titled "${spec.title}" — skipped`);
      missingMod++;
      continue;
    }

    const orderedPages = [];
    for (const pid of mod.pages || []) {
      const pg = await Page.findById(pid);
      if (pg) orderedPages.push(pg);
    }

    for (let i = 0; i < spec.pages.length; i++) {
      const p = spec.pages[i];
      const wantTitle = String(p.title).trim();

      let page = await Page.findOne({ module: mod._id, title: wantTitle });

      if (!page && orderedPages[i] && orderedPages.length === spec.pages.length) {
        page = orderedPages[i];
        orderFallback++;
        console.warn(
          `[sync] Using order fallback [${i}] in "${spec.title}": DB title="${page.title}" ← spec "${wantTitle}"`
        );
      }

      if (!page) {
        console.warn(`[sync] No page "${wantTitle}" in module "${spec.title}" — skipped`);
        missingPage++;
        continue;
      }

      if (page.content === p.html) {
        skipped++;
        continue;
      }
      page.content = p.html;
      await page.save();
      updated++;
      console.log(`[sync] Updated page: "${spec.title}" / "${page.title}" (${page.content.length} chars)`);
    }
  }

  console.log(
    `[sync] Finished: ${updated} updated, ${skipped} unchanged, ${orderFallback} order-fallback matches, ${missingMod} missing modules, ${missingPage} missing pages.`
  );
}

const DEMO_STUDENTS = [
  { firstName: 'Arjun', lastName: 'Menon', email: 'arjun.menon@student.demo.vidyalms.com' },
  { firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@student.demo.vidyalms.com' },
  { firstName: 'Riya', lastName: 'Nair', email: 'riya.nair@student.demo.vidyalms.com' },
  { firstName: 'Kabir', lastName: 'Joshi', email: 'kabir.joshi@student.demo.vidyalms.com' },
  { firstName: 'Ananya', lastName: 'Iyer', email: 'ananya.iyer@student.demo.vidyalms.com' },
  { firstName: 'Vikram', lastName: 'Desai', email: 'vikram.desai@student.demo.vidyalms.com' },
  { firstName: 'Neha', lastName: 'Kapoor', email: 'neha.kapoor@student.demo.vidyalms.com' },
  { firstName: 'Rohan', lastName: 'Verma', email: 'rohan.verma@student.demo.vidyalms.com' },
];

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sumQuestionPoints(questions) {
  return (questions || []).reduce((s, q) => s + (Number(q.points) || 0), 0);
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function avatarUrl(firstName, lastName) {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(`${firstName} ${lastName}`)}`;
}

/** Correct matching answer object keyed by left index → right text */
function correctMatchingJson(q) {
  const out = {};
  const leftItems = q.leftItems || [];
  for (let j = 0; j < leftItems.length; j++) {
    const leftItem = leftItems[j];
    const right = (q.rightItems || []).find((r) => r.id === leftItem.id);
    out[j] = right ? right.text : '';
  }
  return JSON.stringify(out);
}

async function ensureDemoStudents(plainPassword) {
  const out = [];
  for (const s of DEMO_STUDENTS) {
    let u = await User.findOne({ email: s.email });
    if (!u) {
      u = await User.create({
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        password: plainPassword,
        role: 'student',
        profilePicture: avatarUrl(s.firstName, s.lastName),
        bio: `Grade 8 student — ${s.firstName}'s demo profile for MySl8te.`,
      });
      console.log(`[seed] Created student ${s.email}`);
    } else {
      if (!u.profilePicture) {
        u.profilePicture = avatarUrl(s.firstName, s.lastName);
        await u.save();
      }
      console.log(`[seed] Using existing student ${s.email}`);
    }
    out.push(u);
  }
  return out;
}

/** Performance tier 0..1 by roster index (spread for gradebook demos). */
function buildQuizAnswersAndGrades(questions, studentIndex) {
  const answers = {};
  const textIdx = questions.length - 1;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (q.type === 'multiple-choice') {
      const correct = q.options.find((o) => o.isCorrect);
      const wrong = q.options.find((o) => !o.isCorrect);
      const missLastMc = i === 2 && studentIndex % 5 === 0;
      const pickWrong = i === 0 && studentIndex % 7 === 0;
      if (missLastMc || pickWrong) answers[String(i)] = wrong.text;
      else answers[String(i)] = correct.text;
    } else if (q.type === 'matching') {
      const full = correctMatchingJson(q);
      if (studentIndex % 6 === 0) {
        const half = JSON.parse(full);
        const keys = Object.keys(half);
        if (keys.length) delete half[keys[0]];
        answers[String(i)] = JSON.stringify(half);
      } else answers[String(i)] = full;
    } else if (q.type === 'text') {
      answers[String(i)] =
        'I connect the prompt to evidence from the module readings and revise for word choice before submitting.';
    }
  }

  const autoPart = computeMcMatchingQuestionGrades(questions, answers);
  const maxText = Number(questions[textIdx]?.points) || 0;
  const f = perfFraction(studentIndex);
  const textEarned = Math.round(maxText * f);
  const textMap = allocateQuestionGrades(textEarned, [questions[textIdx]]);

  const questionGrades = new Map();
  let total = 0;
  for (let i = 0; i < questions.length; i++) {
    const k = String(i);
    if (i === textIdx) {
      const g = textMap.get('0') || 0;
      questionGrades.set(k, g);
      total += g;
    } else {
      const g = autoPart.get(k) || 0;
      questionGrades.set(k, g);
      total += g;
    }
  }

  const maxPts = sumQuestionPoints(questions);
  const earned = Math.min(total, maxPts);
  return { answers, earned, qMap: questionGrades };
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('[seed] MONGODB_URI is not set. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGO_DB_NAME || 'lms',
    serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || '10000', 10),
  });

  const dbName = mongoose.connection?.db?.databaseName || process.env.MONGO_DB_NAME || 'lms';
  console.log(`[seed] Connected to MongoDB database: ${dbName}`);

  if (syncPagesRequested) {
    const existing = await Course.findOne({ 'catalog.courseCode': COURSE_CODE });
    if (!existing) {
      console.error(
        `[sync] No course with catalog.courseCode "${COURSE_CODE}" in database "${dbName}". Run the seed once without --sync-pages.`
      );
      await mongoose.disconnect();
      process.exit(1);
    }
    console.log(`[sync] Course ${COURSE_CODE} found (_id=${existing._id}). Syncing page HTML…`);
    await syncPageContentFromSpecs(existing._id);
    await mongoose.disconnect();
    return;
  }

  const teacher = await User.findOne({ email: TEACHER_EMAIL.toLowerCase() });
  if (!teacher) {
    console.error(`[seed] No user found with email ${TEACHER_EMAIL}. Create this teacher first, then re-run.`);
    process.exit(1);
  }
  if (teacher.role !== 'teacher' && teacher.role !== 'admin') {
    console.error(`[seed] User ${TEACHER_EMAIL} exists but role is "${teacher.role}". Expected teacher or admin.`);
    process.exit(1);
  }

  const existing = await Course.findOne({ 'catalog.courseCode': COURSE_CODE });
  if (existing) {
    console.log(`[seed] Course with code ${COURSE_CODE} already exists (_id=${existing._id}). Nothing to do.`);
    console.log('[seed] To refresh page HTML: node scripts/seedGrade8EnglishIndiaDemo.js --sync-pages');
    await mongoose.disconnect();
    return;
  }

  const demoPass = process.env.DEMO_STUDENT_PASSWORD || 'VedantaDemo8!';
  const students = await ensureDemoStudents(demoPass);

  const course = await Course.create({
    title: COURSE_TITLE,
    description: COURSE_DESCRIPTION,
    instructor: teacher._id,
    students: students.map((s) => s._id),
    published: true,
    semester: { term: SEMESTER.term, year: SEMESTER.year },
    catalog: {
      isPublic: false,
      subject: 'English',
      description: COURSE_DESCRIPTION,
      courseCode: COURSE_CODE,
      startDate: SEMESTER.start,
      endDate: SEMESTER.end,
      tags: ['Grade 8', 'English', 'CBSE-style', 'Demo', 'India', 'Reading', 'Writing'],
      syllabusContent: SYLLABUS_HTML,
      thumbnail: '/assets/Vedanta_logo.png',
      officeHours: 'Mondays & Wednesdays 3:45–4:30 p.m. IST (link under Meetings)',
    },
    overviewConfig: {
      showLatestAnnouncements: true,
      numberOfAnnouncements: 6,
    },
    defaultColor: '#0f766e',
    groups: [
      { name: 'Weekly homework & process writing', weight: 22 },
      { name: 'Quizzes & checkpoint tasks', weight: 24 },
      { name: 'Projects & presentations', weight: 15 },
      { name: 'Discussions & seminar participation', weight: 14 },
      { name: 'Semester examination', weight: 18 },
      { name: 'Portfolio & reflection', weight: 7 },
    ],
  });
  console.log(`[seed] Created course ${course._id}`);

  const semStart = SEMESTER.start;
  const moduleDocs = [];
  const assignmentPairs = [];

  for (let i = 0; i < MODULE_SPECS.length; i++) {
    const spec = MODULE_SPECS[i];
    const mod = await Module.create({
      title: spec.title,
      course: course._id,
      description: spec.description,
      published: true,
      pages: [],
    });

    const pageIds = [];
    for (const p of spec.pages) {
      const page = await Page.create({
        title: p.title,
        module: mod._id,
        content: p.html,
        published: true,
        attachments: [],
      });
      pageIds.push(page._id);
    }
    mod.pages = pageIds;
    await mod.save();
    moduleDocs.push({ mod, spec, index: i });

    const weekStart = addDays(semStart, i * 7);
    const hwAvail = weekStart;
    const hwDue = addDays(weekStart, 6);
    const qzAvail = addDays(weekStart, 2);
    const qzDue = addDays(weekStart, 8);

    const hwPoints = sumQuestionPoints(spec.homework.questions);
    const rubricBlock = `<p><strong>Grading rubric</strong> is listed in the homework description above. Total points: ${hwPoints}.</p>`;
    const hw = await Assignment.create({
      title: spec.homework.title,
      description: `${spec.homework.description}${rubricBlock}`,
      module: mod._id,
      group: ASSIGN_GROUP.homework,
      availableFrom: hwAvail,
      dueDate: hwDue,
      createdBy: teacher._id,
      questions: spec.homework.questions,
      published: true,
      isOfflineAssignment: true,
      totalPoints: hwPoints,
      allowStudentUploads: true,
    });

    const quizQs = spec.quizQuestionsFull;
    const qzPts = sumQuestionPoints(quizQs);
    const timed = i % 2 === 1;
    const qz = await Assignment.create({
      title: `Quiz — ${spec.title}`,
      description: `<p>Mixed format: multiple choice, matching, and a short constructed response. ${
        timed ? `Timed: <strong>${22} minutes</strong> — pace yourself.` : 'Untimed checkpoint — focus on accuracy.'
      }</p><p>Review the module readings before attempting the matching items.</p>`,
      module: mod._id,
      group: ASSIGN_GROUP.quiz,
      availableFrom: qzAvail,
      dueDate: qzDue,
      createdBy: teacher._id,
      questions: quizQs,
      published: true,
      isGradedQuiz: true,
      isTimedQuiz: timed,
      quizTimeLimit: timed ? 22 : undefined,
      showCorrectAnswers: true,
      totalPoints: qzPts,
    });

    assignmentPairs.push({ hw, qz, spec, index: i });
  }

  const week6 = moduleDocs.find((m) => m.spec.title.includes('Week 6'));
  let miniProject = null;
  if (week6) {
    miniProject = await Assignment.create({
      title: 'Mini-project — Book spine poetry (individual)',
      description: `<p><strong>Task:</strong> Stack 4–6 physical book titles so their spines read as a poem. Photograph clearly. Add a 100–130 word artist statement: theme, why you chose those titles, one revision you made.</p><p><strong>Rubric (20)</strong>: composition &amp; photograph (8), statement depth (8), language (4).</p>`,
      module: week6.mod._id,
      group: ASSIGN_GROUP.project,
      availableFrom: addDays(semStart, 5 * 7),
      dueDate: addDays(semStart, 5 * 7 + 10),
      createdBy: teacher._id,
      questions: [
        {
          id: 'mp1',
          type: 'text',
          text: 'Paste your artist statement (100–130 words).',
          points: 12,
        },
        {
          id: 'mp2',
          type: 'text',
          text: 'List the book titles exactly as they appear on the spines, in order.',
          points: 8,
        },
      ],
      published: true,
      isOfflineAssignment: true,
      totalPoints: 20,
      allowStudentUploads: true,
    });
  }

  const welcomeReplies = [
    {
      author: students[0]._id,
      content: `<p>Namaste — Arjun here. I want to improve my formal letter tone without sounding robotic. I also read fantasy on the side; hoping we connect some analysis skills to stories I already love.</p>`,
      likes: [
        { user: students[1]._id, likedAt: addHours(addDays(semStart, 1), 10) },
        { user: students[4]._id, likedAt: addHours(addDays(semStart, 2), 8) },
      ],
    },
    {
      author: students[1]._id,
      content: `<p>Hi everyone, Priya. My goal is tighter thesis statements in essays. @Arjun for formal letters, Ms Rao’s Week 7 skeleton helped my cousin last year — maybe we can peer-review openings.</p>`,
      likes: [{ user: teacher._id, likedAt: addHours(addDays(semStart, 2), 9) }],
    },
    {
      author: students[2]._id,
      content: `<p>Riya — poetry week is the one I am most excited about. I sometimes overwrite metaphors; I will ask for feedback early.</p>`,
    },
    {
      author: students[5]._id,
      content: `<p>Vikram. Honest confession: I rush unseen passages. I am going to try the three-pass method from Week 2 notes.</p>`,
    },
    {
      author: teacher._id,
      content: `<p>Wonderful goals. I will pair “passage strategy” practice with short timer drills so speed becomes a skill, not a panic.</p>`,
    },
  ];

  await Thread.create({
    title: 'Welcome — English 8 Spring 2026',
    content: `<p>Welcome to <strong>${escHtml(COURSE_TITLE)}</strong>. Reply with your preferred name, one strength in English, and one focus area for May examinations.</p><p>Check <strong>Announcements</strong> each Monday for the week’s rhythm: read → discuss → write → quiz.</p>`,
    course: course._id,
    author: teacher._id,
    published: true,
    isPinned: true,
    lastActivity: addDays(semStart, 2),
      group: ASSIGN_GROUP.discussion,
    settings: { allowLikes: true, allowComments: true },
    replies: welcomeReplies,
  });

  for (const { mod, spec, index } of moduleDocs) {
    const a = students[index % students.length];
    const b = students[(index + 2) % students.length];
    const c = students[(index + 4) % students.length];
    const d = students[(index + 6) % students.length];
    const dueD = addDays(semStart, index * 7 + 6);
    const grades = students.map((st, si) => {
      const base = 5.5 + perfFraction(si) * 4.5;
      return {
        student: st._id,
        grade: Math.round(base * 10) / 10,
        feedback: 'Clear textual reference; next time weave one counterpoint to deepen the argument.',
        gradedAt: addHours(addDays(semStart, index * 7 + 5), 14 + si),
        gradedBy: teacher._id,
      };
    });

    await Thread.create({
      title: `Discussion — ${spec.title}`,
      content: `<p><strong>Prompt:</strong> Connect <em>${escHtml(spec.title)}</em> to a real-life observation from your neighbourhood, school, or news reading. Cite at least one technique or concept from this week’s module pages.</p><p><strong>Requirements:</strong> 120+ words; respond thoughtfully to one classmate; keep tone respectful.</p>`,
      course: course._id,
      module: mod._id,
      author: teacher._id,
      published: true,
      dueDate: dueD,
      isGraded: true,
      totalPoints: 10,
      studentGrades: grades,
      lastActivity: addDays(semStart, index * 7 + 4),
      group: ASSIGN_GROUP.discussion,
      settings: { allowLikes: true, allowComments: true },
      replies: [
        {
          author: a._id,
          content: `<p>I linked the comprehension strategies to how I read match commentary online — same skill, different genre. The “evidence vs assumption” page stopped me from inventing player motives the article never states.</p>`,
          likes: [{ user: b._id, likedAt: addHours(dueD, -20) }],
        },
        {
          author: b._id,
          content: `<p>@${escHtml(a.firstName)} that sports analogy works. I used the same “map” step for a municipal notice about water timing — who is affected, where, what changes.</p>`,
        },
        {
          author: c._id,
          content: `<p>I tried writing my post first in bullet points, then upgraded connectives (“however”, “therefore”) so it reads less like a list.</p>`,
        },
        {
          author: d._id,
          content: `<p>Quick question: if two interpretations fit, is it okay to say the text supports both lightly, or should we pick one for exam answers?</p>`,
        },
        {
          author: teacher._id,
          content: `<p>@${escHtml(d.firstName)} exam answers usually reward the <em>stronger</em> supported reading; you may acknowledge an alternative in one clause, then argue your main line with evidence.</p>`,
        },
      ],
    });
  }

  await Thread.create({
    title: 'Exam prep — unseen passage strategy',
    content: `<p>Share one “timeboxed” routine you will use in the exam hall (e.g., 6 minutes annotate, 10 minutes plan short notes, then write). Compare routines — borrow what fits you.</p>`,
    course: course._id,
    author: teacher._id,
    published: true,
    lastActivity: addDays(semStart, 70),
    group: ASSIGN_GROUP.discussion,
    settings: { allowLikes: true, allowComments: true },
    replies: [
      {
        author: students[3]._id,
        content: `<p>I underline scope words first: “according to the passage”, “the author implies”. Stops me from bringing outside GK.</p>`,
      },
      {
        author: students[6]._id,
        content: `<p>Neha: I number paragraphs in the margin 1–n and write one word tone labels. Sounds childish but it saves me on re-reads.</p>`,
        likes: [{ user: students[0]._id, likedAt: addHours(addDays(semStart, 71), 16) }],
      },
    ],
  });

  await Thread.create({
    title: 'Parent–teacher meeting — questions thread',
    content: `<p>Parents and guardians: if you cannot attend the scheduled Meet, post questions here by Thursday. I will answer publicly so everyone benefits (no confidential marks on this thread).</p>`,
    course: course._id,
    author: teacher._id,
    published: true,
    lastActivity: addDays(semStart, 38),
    group: ASSIGN_GROUP.discussion,
    replies: [
      {
        author: students[4]._id,
        content: `<p>Posting on behalf of my mother’s question: how much weight is on the portfolio reflection vs exams?</p>`,
      },
      {
        author: teacher._id,
        content: `<p>Weights are in the Syllabus tab categories. Exams are important, but steady weekly work is what moves grades most during the semester.</p>`,
      },
    ],
  });

  const announcements = [
    {
      title: 'Welcome to English 8 — Spring 2026',
      body: `<p>Semester runs <strong>6 January</strong> to <strong>15 May 2026</strong>. Modules unlock weekly; keep a reading log even when homework is light.</p>`,
      createdAt: addDays(semStart, 0),
    },
    {
      title: 'Reminder — Week 7 formal letter due Thursday',
      body: `<p>Upload PDF or clear photo if your scanner misbehaves. Check the rubric: tone and format weigh heavily.</p>`,
      createdAt: addDays(semStart, 44),
    },
    {
      title: 'Unit reading checkpoint — bring mentor printouts',
      body: `<p>For in-class discussion on Friday, bring the Week 10 micro-story printout with three annotations you can defend.</p>`,
      createdAt: addDays(semStart, 62),
    },
    {
      title: 'Holiday — Holi weekend (no new assignments)',
      body: `<p>No new tasks assigned 12–16 March. Optional: revise reported speech using Week 8 pages.</p>`,
      createdAt: addDays(semStart, 55),
    },
    {
      title: 'Semester examination window',
      body: `<p>Written exam scheduled in the second week of May; format counts comprehension, grammar, literature short response, and essay. Revision calendar posts next week.</p>`,
      createdAt: addDays(semStart, 100),
    },
    {
      title: 'Parent–teacher meetings — sign-up',
      body: `<p>Slots are under <strong>Meetings</strong>. If times clash, use the PTM questions discussion thread.</p>`,
      createdAt: addDays(semStart, 36),
    },
  ];

  for (const a of announcements) {
    await Announcement.create({
      title: a.title,
      body: a.body,
      course: course._id,
      author: teacher._id,
      postTo: 'all',
      createdAt: a.createdAt,
      options: { allowComments: true, allowLiking: true },
    });
  }

  await Poll.create({
    course: course._id,
    title: 'Which revision topic should we prioritise in April?',
    options: [
      { text: 'Reported speech & mixed grammar', votes: 2 },
      { text: 'Essay structure & counterargument', votes: 3 },
      { text: 'Poetry devices', votes: 1 },
      { text: 'Reading comprehension timing', votes: 2 },
    ],
    createdBy: teacher._id,
    isActive: true,
    endDate: new Date('2026-12-31T23:59:59+05:30'),
    allowMultipleVotes: false,
    resultsVisible: true,
    studentVotes: students.map((s, i) => ({
      student: s._id,
      selectedOptions: [i % 4],
      votedAt: addHours(addDays(semStart, 88), 10 + i * 3),
    })),
  });

  await Poll.create({
    course: course._id,
    title: 'Pace check — how is weekly workload feeling?',
    options: [
      { text: 'About right', votes: 4 },
      { text: 'A bit heavy', votes: 2 },
      { text: 'Light — I want more challenge', votes: 1 },
      { text: 'Varies week to week', votes: 1 },
    ],
    createdBy: teacher._id,
    isActive: true,
    endDate: new Date('2026-12-31T23:59:59+05:30'),
    allowMultipleVotes: false,
    resultsVisible: true,
    studentVotes: students.slice(0, 6).map((s, i) => ({
      student: s._id,
      selectedOptions: [i % 3 === 0 ? 1 : 0],
      votedAt: addDays(semStart, 21 + i),
    })),
  });

  await Poll.create({
    course: course._id,
    title: 'Favourite module so far?',
    options: MODULE_SPECS.slice(0, 6).map((m, i) => ({
      text: m.title.length > 118 ? `${m.title.slice(0, 115)}…` : m.title,
      votes: i === 2 ? 3 : i === 0 ? 2 : 1,
    })),
    createdBy: teacher._id,
    isActive: true,
    endDate: new Date('2026-12-31T23:59:59+05:30'),
    allowMultipleVotes: false,
    resultsVisible: true,
    studentVotes: students.map((s, i) => ({
      student: s._id,
      selectedOptions: [i % 6],
      votedAt: addDays(semStart, 40 + i),
    })),
  });

  await Poll.create({
    course: course._id,
    title: 'Quiz readiness — how do you usually warm up?',
    options: [
      { text: 'Skim notes for 5 minutes', votes: 2 },
      { text: 'Do one old MCQ set', votes: 3 },
      { text: 'Talk through prompts with a friend', votes: 1 },
      { text: 'Jump in cold (not recommended!)', votes: 0 },
    ],
    createdBy: teacher._id,
    isActive: true,
    endDate: new Date('2026-12-31T23:59:59+05:30'),
    allowMultipleVotes: false,
    resultsVisible: true,
    studentVotes: students.map((s, i) => ({
      student: s._id,
      selectedOptions: [i % 4],
      votedAt: addHours(addDays(semStart, 50), 8 + i),
    })),
  });

  const qw1 = await QuizWave.create({
    course: course._id,
    title: 'Grammar & vocabulary sprint — live',
    description: 'Fast warmup: determiners, register, and collocation.',
    questions: [
      {
        questionText: 'Choose the best sentence:',
        questionType: 'multiple-choice',
        options: [
          { text: 'She gave me an advice.', isCorrect: false },
          { text: 'She gave me advice.', isCorrect: true },
          { text: 'She gave me advices.', isCorrect: false },
          { text: 'She gave me some advices.', isCorrect: false },
        ],
        points: 4,
        order: 0,
        timeLimit: 28,
      },
      {
        questionText: '“Fewer” pairs best with:',
        questionType: 'multiple-choice',
        options: [
          { text: 'water (uncountable)', isCorrect: false },
          { text: 'mistakes (countable plural)', isCorrect: true },
          { text: 'time (uncountable)', isCorrect: false },
          { text: 'noise (uncountable)', isCorrect: false },
        ],
        points: 4,
        order: 1,
        timeLimit: 28,
      },
      {
        questionText: 'A thesis should be:',
        questionType: 'multiple-choice',
        options: [
          { text: 'A question only', isCorrect: false },
          { text: 'A contestable claim aligned to the prompt', isCorrect: true },
          { text: 'A quote from a famous person', isCorrect: false },
          { text: 'A list of random facts', isCorrect: false },
        ],
        points: 5,
        order: 2,
        timeLimit: 32,
      },
    ],
    settings: { showLeaderboard: true, showCorrectAnswer: true, maxSessionDuration: 35 },
    createdBy: teacher._id,
    isActive: true,
  });

  const qw2 = await QuizWave.create({
    course: course._id,
    title: 'Literature & reading strategy sprint — live',
    description: 'Inference, tone, and narrator limitations.',
    questions: [
      {
        questionText: 'Inference must be:',
        questionType: 'multiple-choice',
        options: [
          { text: 'Anything you guess', isCorrect: false },
          { text: 'Supported by textual details', isCorrect: true },
          { text: 'The same as summary', isCorrect: false },
          { text: 'A moral command', isCorrect: false },
        ],
        points: 5,
        order: 0,
        timeLimit: 30,
      },
      {
        questionText: 'Limited third-person narration means:',
        questionType: 'multiple-choice',
        options: [
          { text: 'The narrator knows all minds at all times', isCorrect: false },
          { text: 'The narration follows selected consciousness closely', isCorrect: true },
          { text: 'Only dialogue, no narration', isCorrect: false },
          { text: 'Second person only', isCorrect: false },
        ],
        points: 5,
        order: 1,
        timeLimit: 30,
      },
      {
        questionText: 'True or false: Tone is the author’s attitude suggested by language.',
        questionType: 'true-false',
        options: [
          { text: 'True', isCorrect: true },
          { text: 'False', isCorrect: false },
        ],
        points: 3,
        order: 2,
        timeLimit: 20,
      },
    ],
    settings: { showLeaderboard: true, showCorrectAnswer: true, maxSessionDuration: 40 },
    createdBy: teacher._id,
    isActive: true,
  });

  const pin1 = await QuizSession.generateGamePin();
  const pin2 = await QuizSession.generateGamePin();

  await QuizSession.create({
    quiz: qw1._id,
    course: course._id,
    gamePin: pin1,
    status: 'active',
    currentQuestionIndex: 1,
    startedAt: addHours(addDays(semStart, 18), 9),
    createdBy: teacher._id,
    participants: students.slice(0, 5).map((s, i) => ({
      student: s._id,
      nickname: `${s.firstName}${i}`,
      joinedAt: addMinutes(addHours(addDays(semStart, 18), 9), 4 + i * 2),
      totalScore: 6 + i,
      answers: [],
    })),
  });

  await QuizSession.create({
    quiz: qw2._id,
    course: course._id,
    gamePin: pin2,
    status: 'active',
    currentQuestionIndex: 0,
    startedAt: addHours(addDays(semStart, 48), 11),
    createdBy: teacher._id,
    participants: students.slice(2, 8).map((s, i) => ({
      student: s._id,
      nickname: `${s.firstName}L`,
      joinedAt: addMinutes(addHours(addDays(semStart, 48), 11), 3 + i),
      totalScore: 4 + (i % 4) * 2,
      answers: [],
    })),
  });

  const litSet = await GroupSet.create({
    name: 'Literature circle teams',
    course: course._id,
    allowSelfSignup: false,
    groupStructure: 'manual',
  });

  const debateSet = await GroupSet.create({
    name: 'Debate squads',
    course: course._id,
    allowSelfSignup: false,
    groupStructure: 'manual',
  });

  const mkGroupId = (label) =>
    `eng8-demo-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const litGroups = [];
  for (let g = 0; g < 4; g++) {
    const m1 = students[g * 2];
    const m2 = students[g * 2 + 1];
    litGroups.push(
      await Group.create({
        name: `Literature circle ${g + 1}`,
        groupSet: litSet._id,
        course: course._id,
        members: [m1._id, m2._id],
        leader: m1._id,
        groupId: mkGroupId(`lit-${g}`),
      })
    );
  }

  const debateGroups = [];
  const pairs = [
    [0, 2],
    [1, 3],
    [4, 6],
    [5, 7],
  ];
  for (let g = 0; g < 4; g++) {
    const [i, j] = pairs[g];
    const m1 = students[i];
    const m2 = students[j];
    debateGroups.push(
      await Group.create({
        name: `Debate squad ${g + 1}`,
        groupSet: debateSet._id,
        course: course._id,
        members: [m1._id, m2._id],
        leader: m1._id,
        groupId: mkGroupId(`deb-${g}`),
      })
    );
  }

  const w10 = moduleDocs.find((m) => m.spec.title.includes('Week 10'));
  const litAssignment = await Assignment.create({
    title: 'Group task — literature seminar notes (collaborative)',
    description: `<p>With your literature circle, co-author <strong>one</strong> set of seminar notes: three themes, six evidence quotes (max 15 words each), and two discussion questions for the class.</p><p><strong>Rubric (24)</strong>: evidence quality (10), questions (8), collaboration statement (6).</p>`,
    availableFrom: addDays(semStart, 9 * 7),
    dueDate: addDays(semStart, 10 * 7 + 3),
    createdBy: teacher._id,
    group: ASSIGN_GROUP.project,
    questions: [
      {
        id: 'lg1',
        type: 'text',
        text: 'Paste seminar notes (max 450 words) + list each member’s contribution in one line.',
        points: 24,
      },
    ],
    published: true,
    isGroupAssignment: true,
    groupSet: litSet._id,
    isOfflineAssignment: true,
    totalPoints: 24,
    allowStudentUploads: true,
  });

  const debateAssignment = await Assignment.create({
    title: 'Debate prep — motion: “Digital textbooks should replace paper for Class 8.”',
    description: `<p>Work in your debate squad. Submit: (1) definition of terms, (2) two arguments FOR, (3) two arguments AGAINST, (4) two rebuttal targets.</p><p><strong>Rubric (26)</strong>: clarity (8), balance (10), civility & structure (8).</p>`,
    availableFrom: addDays(semStart, 8 * 7),
    dueDate: addDays(semStart, 9 * 7 + 5),
    createdBy: teacher._id,
    group: ASSIGN_GROUP.project,
    questions: [
      {
        id: 'db1',
        type: 'text',
        text: 'Paste combined prep sheet (max 500 words).',
        points: 26,
      },
    ],
    published: true,
    isGroupAssignment: true,
    groupSet: debateSet._id,
    isOfflineAssignment: true,
    totalPoints: 26,
    allowStudentUploads: true,
  });

  await Thread.create({
    title: 'Literature circles — scheduling',
    content: `<p>Use this thread only for scheduling shared reading slots. Content questions go to the weekly module discussion.</p>`,
    course: course._id,
    module: w10 ? w10.mod._id : undefined,
    groupSet: litSet._id,
    author: teacher._id,
    published: true,
    lastActivity: addDays(semStart, 64),
    group: ASSIGN_GROUP.discussion,
  });

  const lastModForCatchAll = moduleDocs[moduleDocs.length - 1].mod;
  const examAssignment = await Assignment.create({
    title: 'Semester examination — practice paper (reading & writing)',
    description: `<p><strong>60 points.</strong> Mixed short responses modelled on the May examination. Submit your completed practice in the answer box.</p>`,
    module: lastModForCatchAll._id,
    group: ASSIGN_GROUP.exam,
    availableFrom: addDays(semStart, 65),
    dueDate: addDays(semStart, 102),
    createdBy: teacher._id,
    questions: [
      {
        id: 'ex1',
        type: 'text',
        text: 'Paste your full practice response (all sections combined).',
        points: 60,
      },
    ],
    published: true,
    isOfflineAssignment: true,
    totalPoints: 60,
    allowStudentUploads: true,
  });

  const portfolioAssignment = await Assignment.create({
    title: 'Semester portfolio reflection (goals & evidence)',
    description: `<p><strong>25 points.</strong> Connect two polished pieces from the term to specific feedback and set one measurable goal for Grade 9.</p>`,
    module: lastModForCatchAll._id,
    group: ASSIGN_GROUP.portfolio,
    availableFrom: addDays(semStart, 72),
    dueDate: addDays(semStart, 105),
    createdBy: teacher._id,
    questions: [
      {
        id: 'pf1',
        type: 'text',
        text: 'Reflection (200–280 words): strengths, one challenge, one goal with evidence.',
        points: 25,
      },
    ],
    published: true,
    isOfflineAssignment: true,
    totalPoints: 25,
    allowStudentUploads: true,
  });

  await GroupMeeting.create({
    group: null,
    course: course._id,
    createdBy: teacher._id,
    title: 'Whole class — Weekly English (live)',
    description: 'Skills mini-lesson + silent reading block. Bring your vocabulary log.',
    startTime: addDays(semStart, 3),
    durationMinutes: 50,
    joinUrl: 'https://meet.demo.vidyalms.com/eng8-weekly',
    recordingUrl: '',
    provider: 'zoho_meeting',
    status: 'scheduled',
  });

  await GroupMeeting.create({
    group: null,
    course: course._id,
    createdBy: teacher._id,
    title: 'Doubt-solving — grammar & writing',
    description: 'Open Q&A; priority to students who posted questions before noon.',
    startTime: addHours(addDays(semStart, 10), 17),
    durationMinutes: 40,
    joinUrl: 'https://meet.demo.vidyalms.com/eng8-doubts',
    provider: 'zoho_meeting',
    status: 'scheduled',
  });

  await GroupMeeting.create({
    group: null,
    course: course._id,
    createdBy: teacher._id,
    title: 'Revision sprint — comprehension + essay outlines',
    description: 'We will model two outlines under time pressure.',
    startTime: addDays(semStart, 84),
    durationMinutes: 55,
    joinUrl: 'https://meet.demo.vidyalms.com/eng8-revision',
    provider: 'zoho_meeting',
    status: 'scheduled',
  });

  await GroupMeeting.create({
    group: null,
    course: course._id,
    createdBy: teacher._id,
    title: 'Exam preparation — question expectations',
    description: 'Walkthrough of mark schemes and time management.',
    startTime: addDays(semStart, 112),
    durationMinutes: 45,
    joinUrl: 'https://meet.demo.vidyalms.com/eng8-exam-prep',
    provider: 'zoho_meeting',
    status: 'scheduled',
  });

  await GroupMeeting.create({
    group: litGroups[0]._id,
    course: course._id,
    createdBy: teacher._id,
    title: 'Literature circle 1 — mentor check-in',
    description: 'Confirm shared document access and citation format.',
    startTime: addDays(semStart, 66),
    durationMinutes: 25,
    joinUrl: 'https://meet.demo.vidyalms.com/eng8-lit1',
    provider: 'zoho_meeting',
    status: 'scheduled',
  });

  for (const { qz, spec, index: modIdx } of assignmentPairs) {
    const quizQs = spec.quizQuestionsFull;
    const { missing, late } = noMissingNoLate();
    for (let si = 0; si < students.length; si++) {
      if (missing.has(si)) continue;
      const st = students[si];
      const { answers, earned, qMap } = buildQuizAnswersAndGrades(quizQs, si);
      let submittedAt;
      if (late.has(si)) {
        submittedAt = addHours(addDays(qz.dueDate, 1 + (si % 2)), 16 + si);
      } else {
        submittedAt = addMinutes(addHours(addDays(qz.availableFrom, 1 + (si % 3)), 15 + si), 25 + si * 7);
      }
      const gradedAt = addHours(submittedAt, 6 + (si % 5));
      await Submission.create({
        assignment: qz._id,
        student: st._id,
        submittedBy: st._id,
        answers,
        submittedAt,
        autoGraded: true,
        autoGrade: earned,
        autoQuestionGrades: qMap,
        teacherApproved: true,
        finalGrade: earned,
        grade: earned,
        questionGrades: qMap,
        gradedBy: teacher._id,
        gradedAt,
      });
    }
  }

  const hwManualGrades = [17, 19, 18, 16, 15, 14, 17, 16];
  for (let i = 0; i < assignmentPairs.length; i++) {
    const { hw, spec } = assignmentPairs[i];
    const pts = sumQuestionPoints(spec.homework.questions);
    const { missing, late } = noMissingNoLate();
    for (let si = 0; si < students.length; si++) {
      if (missing.has(si)) continue;
      const st = students[si];
      const cap = Math.min(hwManualGrades[si % hwManualGrades.length], pts);
      const target = Math.round(cap * perfFraction(si));
      const g = Math.min(target, pts);
      const questionGrades = allocateQuestionGrades(g, spec.homework.questions);
      let submittedAt;
      if (late.has(si)) {
        submittedAt = addHours(addDays(hw.dueDate, 1 + (si % 3)), 20 + si);
      } else {
        submittedAt = addMinutes(addHours(addDays(hw.availableFrom, 2 + (si % 4)), 16 + si), 30 + si * 11);
      }
      const gradedAt = addHours(submittedAt, 10 + (si % 6));
      await Submission.create({
        assignment: hw._id,
        student: st._id,
        submittedBy: st._id,
        answers: Object.fromEntries(
          spec.homework.questions.map((q, qi) => [
            String(qi),
            `Draft revised twice. Focus: ${(q.text || '').slice(0, 40)}…`,
          ])
        ),
        submittedAt,
        questionGrades,
        grade: g,
        finalGrade: g,
        teacherApproved: true,
        gradedBy: teacher._id,
        gradedAt,
        feedback:
          'Thoughtful connections to the module readings. Tighten transitions between paragraphs next submission.',
      });
    }
  }

  const exQ = examAssignment.questions;
  const pfQ = portfolioAssignment.questions;
  for (let si = 0; si < students.length; si++) {
    const st = students[si];
    const f = perfFraction(si);
    const examPts = Math.min(60, Math.round(60 * f * 0.95 + (si % 2)));
    const portfolioPts = Math.min(25, Math.round(25 * f * 0.96));
    await Submission.create({
      assignment: examAssignment._id,
      student: st._id,
      submittedBy: st._id,
      answers: { '0': 'Practice paper completed with timed self-review per exam instructions.' },
      submittedAt: addHours(addDays(examAssignment.dueDate, -2), 11 + si),
      questionGrades: allocateQuestionGrades(examPts, exQ),
      grade: examPts,
      finalGrade: examPts,
      teacherApproved: true,
      gradedBy: teacher._id,
      gradedAt: addHours(addDays(examAssignment.dueDate, -1), 10),
      feedback: 'Organised response; continue underlining command words in prompts.',
    });
    await Submission.create({
      assignment: portfolioAssignment._id,
      student: st._id,
      submittedBy: st._id,
      answers: { '0': 'Reflection ties two revisions to peer feedback on thesis and tone.' },
      submittedAt: addHours(addDays(portfolioAssignment.dueDate, -3), 14 + si),
      questionGrades: allocateQuestionGrades(portfolioPts, pfQ),
      grade: portfolioPts,
      finalGrade: portfolioPts,
      teacherApproved: true,
      gradedBy: teacher._id,
      gradedAt: addHours(addDays(portfolioAssignment.dueDate, -2), 9),
      feedback: 'Honest self-assessment with concrete next steps.',
    });
  }

  if (miniProject) {
    const mpQs = miniProject.questions;
    for (let si = 0; si < students.length; si++) {
      const st = students[si];
      const g = Math.min(20, Math.round(20 * perfFraction(si) * 0.92));
      const qg = allocateQuestionGrades(g, mpQs);
      await Submission.create({
        assignment: miniProject._id,
        student: st._id,
        submittedBy: st._id,
        answers: {
          '0': `Artist statement — theme: memory and city sound. Revised word choice after peer feedback.`,
          '1': 'Titles (example): The Blue Umbrella · A Short History of Nearly Everything · Sea of Poppies · Collected Poems',
        },
        submittedAt: addHours(addDays(miniProject.dueDate, -2), 18 + si),
        questionGrades: qg,
        grade: g,
        finalGrade: g,
        teacherApproved: true,
        gradedBy: teacher._id,
        gradedAt: addHours(addDays(miniProject.dueDate, -1), 10),
        feedback: 'Creative constraint met; photograph could be brighter next time.',
      });
    }
  }

  const litQ = litAssignment.questions;
  for (let gi = 0; gi < litGroups.length; gi++) {
    const grp = litGroups[gi];
    const leader = students[gi * 2];
    const g = 20 + (gi % 3);
    await Submission.create({
      assignment: litAssignment._id,
      student: leader._id,
      group: grp._id,
      submittedBy: leader._id,
      submissionText: 'Seminar notes compiled in shared doc; themes: fairness, voice, responsibility.',
      answers: {
        lg1: `Circle ${gi + 1}: themes + evidence + questions attached as structured notes.`,
      },
      submittedAt: addHours(addDays(litAssignment.dueDate, -1), 19),
      questionGrades: allocateQuestionGrades(Math.min(g, 24), litQ),
      grade: Math.min(g, 24),
      finalGrade: Math.min(g, 24),
      teacherApproved: true,
      gradedBy: teacher._id,
      gradedAt: addHours(litAssignment.dueDate, 9),
      feedback: 'Strong evidence selection; integrate one counter-reading next time.',
    });
  }

  const debQ = debateAssignment.questions;
  for (let gi = 0; gi < debateGroups.length; gi++) {
    const grp = debateGroups[gi];
    const leader = students[[0, 2, 4, 5][gi]];
    const g = 22;
    await Submission.create({
      assignment: debateAssignment._id,
      student: leader._id,
      group: grp._id,
      submittedBy: leader._id,
      submissionText: 'Prep sheet: defined digital textbook; balanced arguments; rebuttal targets noted.',
      answers: { db1: 'See structured prep in this submission text field + summary here.' },
      submittedAt: addHours(debateAssignment.dueDate, -3),
      questionGrades: allocateQuestionGrades(Math.min(g, 26), debQ),
      grade: Math.min(g, 26),
      finalGrade: Math.min(g, 26),
      teacherApproved: true,
      gradedBy: teacher._id,
      gradedAt: addHours(debateAssignment.dueDate, -2),
      feedback: 'Civil tone and clear definitions; strengthen rebuttal targets with exact opposing claims.',
    });
  }

  const tuesdayHrs = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
  let attCreated = 0;
  for (let w = 0; w < tuesdayHrs.length; w++) {
    const classDate = addHours(addDays(semStart, 2 + w * 7), tuesdayHrs[w]);
    for (let si = 0; si < students.length; si++) {
      const st = students[si];
      let status = 'present';
      if ((si + w) % 11 === 0) status = 'absent';
      else if ((si + w) % 9 === 0) status = 'late';
      else if ((si + w) % 14 === 0) status = 'excused';
      await Attendance.create({
        course: course._id,
        student: st._id,
        date: classDate,
        status,
        markedBy: teacher._id,
        notes: status === 'late' ? 'Joined 12 minutes after bell' : '',
      });
      attCreated++;
    }
  }

  const conv = await Conversation.create({
    subject: 'English 8 — quick check-in on your essay thesis',
    course: course._id,
    createdBy: teacher._id,
  });
  const m1 = await Message.create({
    conversationId: conv._id,
    senderId: teacher._id,
    body: 'Hi Arjun — skimmed your Week 9 outline. Your thesis is promising; consider naming one counter-case explicitly in paragraph 2.',
  });
  const m2 = await Message.create({
    conversationId: conv._id,
    senderId: students[0]._id,
    body: 'Thank you — I will move the phone-ban counterargument up and trim the opening anecdote.',
  });
  const m3 = await Message.create({
    conversationId: conv._id,
    senderId: teacher._id,
    body: 'Good plan. Send the revised thesis line before Friday if you want a one-sentence confirmation.',
  });
  await ConversationParticipant.create([
    {
      conversationId: conv._id,
      userId: teacher._id,
      lastReadAt: m3.createdAt,
      folder: 'inbox',
    },
    {
      conversationId: conv._id,
      userId: students[0]._id,
      lastReadAt: m1.createdAt,
      folder: 'inbox',
    },
  ]);

  const notifs = [
    {
      user: students[1]._id,
      type: 'assignment_due',
      title: 'Assignment due soon',
      message: `Homework for ${MODULE_SPECS[3].title} closes in 48 hours.`,
      read: false,
      link: `/courses/${course._id}/assignments`,
      relatedType: 'assignment',
      priority: 'high',
    },
    {
      user: students[3]._id,
      type: 'discussion',
      title: 'New discussion activity',
      message: 'Your teacher replied in a graded discussion thread.',
      read: false,
      link: `/courses/${course._id}/discussions`,
      relatedType: 'discussion',
    },
    {
      user: students[0]._id,
      type: 'message',
      title: 'New message',
      message: 'You have a new message about your essay thesis.',
      read: true,
      readAt: addHours(addDays(semStart, 60), 8),
      link: `/courses/${course._id}`,
      relatedType: 'message',
    },
    {
      user: students[5]._id,
      type: 'announcement',
      title: 'New announcement',
      message: 'Semester examination window posted.',
      read: false,
      link: `/courses/${course._id}/announcements`,
      relatedType: 'announcement',
    },
    {
      user: teacher._id,
      type: 'submission',
      title: 'New submission',
      message: 'A student submitted the Week 5 quiz.',
      read: false,
      link: `/courses/${course._id}/assignments`,
      relatedType: 'submission',
    },
  ];
  for (const n of notifs) {
    await Notification.create({
      user: n.user,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read ?? false,
      readAt: n.readAt ?? null,
      link: n.link,
      relatedType: n.relatedType,
      priority: n.priority || 'medium',
    });
  }

  const threadCount = await Thread.countDocuments({ course: course._id });
  const annCount = await Announcement.countDocuments({ course: course._id });
  const pollCount = await Poll.countDocuments({ course: course._id });
  const assignCount = await Assignment.countDocuments({ module: { $in: moduleDocs.map((m) => m.mod._id) } });
  const assignGroupOnly = await Assignment.countDocuments({
    isGroupAssignment: true,
    groupSet: { $in: [litSet._id, debateSet._id] },
  });
  const subCount = await Submission.countDocuments({ assignment: { $in: assignmentPairs.map((a) => a.qz._id) } });

  console.log('[seed] Done.', {
    courseId: String(course._id),
    courseCode: COURSE_CODE,
    modules: MODULE_SPECS.length,
    assignmentsInModules: assignCount,
    groupAssignments: assignGroupOnly,
    miniProject: miniProject ? 1 : 0,
    threads: threadCount,
    announcements: annCount,
    polls: pollCount,
    quizWaveIds: [String(qw1._id), String(qw2._id)],
    quizSessionsPins: [pin1, pin2],
    attendanceRecords: attCreated,
    demoSubmissionsOnWeeklyQuizzes: subCount,
    literatureGroupSetId: String(litSet._id),
    debateGroupSetId: String(debateSet._id),
  });
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[seed] Failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
