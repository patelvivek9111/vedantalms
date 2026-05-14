'use strict';

/**
 * Seeds a full-semester Grade 8 Mathematics (Indian / NCERT-style) demo course
 * for the teacher account teacher@vidyalms.com.
 *
 * Usage:
 *   node scripts/seedGrade8MathIndiaDemo.js
 *   node scripts/seedGrade8MathIndiaDemo.js --sync-pages   # refresh Page.content from demoData when course already exists
 *
 * Requires: MONGODB_URI (and optional MONGO_DB_NAME). Full seed also needs teacher user teacher@vidyalms.com.
 * Optional: DEMO_STUDENT_PASSWORD (default VedantaDemo8!) for created demo students.
 * Idempotent: skips creation if a course with catalog.courseCode DEMO-MATH8-IN-2026 already exists
 * (use --sync-pages to push updated HTML from grade8MathIndiaModules.js into existing pages).
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
const { QuizWave } = require('../models/quizwave.model');
const GroupSet = require('../models/GroupSet');
const Group = require('../models/Group');
const GroupMeeting = require('../models/groupMeeting.model');
const Submission = require('../models/Submission');

const {
  SEMESTER,
  COURSE_CODE,
  COURSE_TITLE,
  COURSE_DESCRIPTION,
  SYLLABUS_HTML,
  MODULE_SPECS,
} = require('./demoData/grade8MathIndiaModules');
const {
  allocateQuestionGrades,
  addHours,
  addMinutes,
  pickMissingAndLate,
  buildMcAutoQuestionGrades,
} = require('./demoData/seedDemoHelpers');

const TEACHER_EMAIL = 'teacher@vidyalms.com';

const syncPagesRequested =
  process.argv.includes('--sync-pages') || process.env.SYNC_GRADE8_MATH8_PAGES === 'true';

/** Push MODULE_SPECS page HTML into existing demo course (match by title, then by order in module.pages). */
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
  if (updated === 0 && missingPage === 0 && missingMod === 0 && skipped > 0) {
    console.log('[sync] All pages already matched file content. If the app still shows old text, the API is using a different database than this script.');
  }
  if (updated === 0 && (missingPage > 0 || missingMod > 0)) {
    console.log('[sync] Hint: Open MongoDB Compass / Atlas and confirm this database has course code ' + COURSE_CODE + ' and module titles exactly as in grade8MathIndiaModules.js.');
  }
}

const DEMO_STUDENTS = [
  { firstName: 'Arjun', lastName: 'Menon', email: 'arjun.menon@student.demo.vidyalms.com' },
  { firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@student.demo.vidyalms.com' },
  { firstName: 'Riya', lastName: 'Nair', email: 'riya.nair@student.demo.vidyalms.com' },
  { firstName: 'Kabir', lastName: 'Joshi', email: 'kabir.joshi@student.demo.vidyalms.com' },
  { firstName: 'Ananya', lastName: 'Iyer', email: 'ananya.iyer@student.demo.vidyalms.com' },
  { firstName: 'Vikram', lastName: 'Desai', email: 'vikram.desai@student.demo.vidyalms.com' },
];

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function toMcQuestions(quizItems) {
  return quizItems.map((q, idx) => ({
    id: `q${idx}`,
    type: 'multiple-choice',
    text: q.stem,
    points: q.points ?? 2,
    options: q.choices.map((text, i) => ({
      text,
      isCorrect: i === q.correct,
    })),
  }));
}

function sumQuestionPoints(questions) {
  return questions.reduce((s, q) => s + (q.points || 0), 0);
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
      });
      console.log(`[seed] Created student ${s.email}`);
    } else {
      console.log(`[seed] Using existing student ${s.email}`);
    }
    out.push(u);
  }
  return out;
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
        `[sync] No course with catalog.courseCode "${COURSE_CODE}" in database "${dbName}". Run: npm run seed:demo:math8-india (without --sync-pages) once to create it.`
      );
      await mongoose.disconnect();
      process.exit(1);
    }
    console.log(`[sync] Course ${COURSE_CODE} found (_id=${existing._id}). Syncing page HTML from MODULE_SPECS…`);
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
    console.log('[seed] To refresh module page content from scripts/demoData/grade8MathIndiaModules.js, run:');
    console.log('      npm run seed:demo:math8-india:sync-pages');
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
      subject: 'Mathematics',
      description: COURSE_DESCRIPTION,
      courseCode: COURSE_CODE,
      startDate: SEMESTER.start,
      endDate: SEMESTER.end,
      tags: ['Grade 8', 'NCERT', 'CBSE', 'Demo', 'India'],
      syllabusContent: SYLLABUS_HTML,
      officeHours: 'Tuesdays & Thursdays 4:00–5:00 p.m. IST (Google Meet link posted weekly in Announcements)',
    },
    overviewConfig: {
      showLatestAnnouncements: true,
      numberOfAnnouncements: 5,
    },
    defaultColor: '#1e40af',
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

    const hwAvail = addDays(semStart, i * 14);
    const hwDue = addDays(semStart, i * 14 + 10);
    const qzAvail = addDays(semStart, i * 14 + 3);
    const qzDue = addDays(semStart, i * 14 + 12);

    const hwPoints = sumQuestionPoints(spec.homework.questions);
    const hw = await Assignment.create({
      title: spec.homework.title,
      description: spec.homework.description,
      module: mod._id,
      availableFrom: hwAvail,
      dueDate: hwDue,
      createdBy: teacher._id,
      questions: spec.homework.questions,
      published: true,
      isOfflineAssignment: true,
      totalPoints: hwPoints,
      allowStudentUploads: false,
    });

    const quizQs = toMcQuestions(spec.quiz);
    const qzPts = sumQuestionPoints(quizQs);
    const qz = await Assignment.create({
      title: `Quiz — ${spec.title}`,
      description:
        'Auto-graded multiple choice. You may attempt once before the due date; review the module pages if you miss a question.',
      module: mod._id,
      availableFrom: qzAvail,
      dueDate: qzDue,
      createdBy: teacher._id,
      questions: quizQs,
      published: true,
      isGradedQuiz: true,
      showCorrectAnswers: true,
      totalPoints: qzPts,
    });

    assignmentPairs.push({ hw, qz, spec, index: i });
  }

  await Thread.create({
    title: 'Welcome — introduce yourself',
    content: `<p>Namaste and welcome to Grade 8 Mathematics for Spring 2026.</p><p>Reply with:</p><ul><li>Your preferred name</li><li>One mathematics topic you enjoy</li><li>One goal for this semester</li></ul><p>I will read every post in the first week.</p>`,
    course: course._id,
    author: teacher._id,
    published: true,
    isPinned: true,
    lastActivity: addDays(semStart, 2),
    group: 'Discussions',
    replies: [
      {
        author: students[0]._id,
        content: `<p>Hi everyone — Arjun here. I actually enjoy mensuration because it feels like solving little puzzles with real boxes. My goal is to stop rushing the last step of proofs.</p>`,
      },
      {
        author: students[1]._id,
        content: `<p>Hi Arjun, Priya from Section B. I like data handling because we can talk about real surveys. @Arjun do you use grid paper for 3D sketches or plain notebook?</p>`,
      },
      {
        author: students[2]._id,
        content: `<p>Riya here — I mostly use grid paper for nets. @Priya we did a small survey in our apartment on water usage; I can share the frequency table if that helps your project idea.</p>`,
      },
      {
        author: students[3]._id,
        content: `<p>Kabir — I am weaker at speed–time graphs but stronger at algebra. Happy to trade practice problems with anyone.</p>`,
      },
      {
        author: teacher._id,
        content: `<p>Wonderful thread already. @Kabir I will post two graph-reading starters in the “Introduction to Graphs” module this week — try them without a timer first.</p>`,
      },
    ],
  });

  for (const { mod, spec, index } of moduleDocs) {
    const a = students[index % students.length];
    const b = students[(index + 2) % students.length];
    const c = students[(index + 4) % students.length];
    await Thread.create({
      title: `Discussion: ${spec.title}`,
      content: `<p><strong>Prompt:</strong> Post one worked example or one “real life” situation that connects to <em>${escHtml(
        spec.title
      )}</em>. Comment on at least one classmate’s post with a question or an improvement suggestion.</p><p>Quality expectations: use correct vocabulary, show reasoning, and keep tone respectful.</p>`,
      course: course._id,
      module: mod._id,
      author: teacher._id,
      published: true,
      dueDate: addDays(semStart, index * 14 + 11),
      isGraded: true,
      totalPoints: 10,
      lastActivity: addDays(semStart, index * 14 + 8),
      group: 'Discussions',
      replies: [
        {
          author: a._id,
          content: `<p>I tried a textbook problem and then changed the numbers slightly. Here is my work in words: define the variable, form the equation, transpose, verify. Could someone check if my verification line is enough for half marks?</p>`,
        },
        {
          author: b._id,
          content: `<p>@${escHtml(a.firstName)} your steps sound complete — I would add one line that states the property when you move terms across the equals sign. Also units if it is a word problem.</p>`,
        },
        {
          author: c._id,
          content: `<p>Real-life link: my mother compares mobile prepaid packs using percentages and “effective cost per GB.” It is basically comparing quantities from our unit.</p>`,
        },
        {
          author: students[(index + 1) % students.length]._id,
          content: `<p>@${escHtml(c.firstName)} that is a cool example. Do you treat the rollover data as a separate “plan” or merge into one table?</p>`,
        },
        {
          author: teacher._id,
          content: `<p>Strong discussion. I will reference two of these examples in tomorrow’s recap — keep the tone supportive and specific when you @ each other.</p>`,
        },
      ],
    });
  }

  const announcements = [
    {
      title: 'Welcome to Spring 2026 — Mathematics 8',
      body: `<p>Our semester runs from <strong>6 January</strong> to <strong>15 May 2026</strong>. Please read the Syllabus tab for grading weights and the weekly rhythm (practice → quiz → discussion).</p><p>First full module: Rational numbers. Bring your NCERT textbook to class.</p>`,
      createdAt: addDays(semStart, 0),
    },
    {
      title: 'Scientific calculators for mensuration unit',
      body: `<p>From <strong>1 April</strong>, you may use a basic scientific calculator in class for mensuration and compound interest estimates only, unless a task says “without calculator.”</p>`,
      createdAt: addDays(semStart, 70),
    },
    {
      title: 'Revision plan for April',
      body: `<p>We will spiral back through <em>exponents, comparing quantities, and graphs</em>. Use the short “Quiz” checks as spaced repetition — scores are for feedback, not punishment.</p>`,
      createdAt: addDays(semStart, 85),
    },
    {
      title: 'Group project checkpoint — Data Handling',
      body: `<p>Teams should upload a one-page summary of your dataset and two charts (histogram + one other) by the date in Assignments. I will give written feedback within 48 hours.</p>`,
      createdAt: addDays(semStart, 55),
    },
    {
      title: 'Parent–teacher meeting week',
      body: `<p>Optional Google Meet slots are posted under <strong>Meetings</strong>. If parents cannot attend, they may reply to this announcement thread with questions.</p>`,
      createdAt: addDays(semStart, 40),
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
    title: 'When do you usually revise mathematics?',
    options: [
      { text: 'Right after school', votes: 1 },
      { text: 'After dinner', votes: 4 },
      { text: 'Weekend mornings', votes: 1 },
      { text: 'Mixed / irregular', votes: 0 },
    ],
    createdBy: teacher._id,
    isActive: true,
    endDate: new Date('2026-12-31T23:59:59+05:30'),
    allowMultipleVotes: false,
    resultsVisible: true,
    studentVotes: [
      { student: students[0]._id, selectedOptions: [1], votedAt: addDays(semStart, 3) },
      { student: students[1]._id, selectedOptions: [1], votedAt: addDays(semStart, 3) },
      { student: students[2]._id, selectedOptions: [1], votedAt: addDays(semStart, 4) },
      { student: students[3]._id, selectedOptions: [1], votedAt: addDays(semStart, 4) },
      { student: students[4]._id, selectedOptions: [0], votedAt: addDays(semStart, 5) },
      { student: students[5]._id, selectedOptions: [2], votedAt: addDays(semStart, 5) },
    ],
  });

  await Poll.create({
    course: course._id,
    title: 'Which tool helps you most for graphs?',
    options: [
      { text: 'Grid notebook + pencil', votes: 3 },
      { text: 'GeoGebra / Desmos on laptop', votes: 2 },
      { text: 'Graph paper only', votes: 1 },
    ],
    createdBy: teacher._id,
    isActive: true,
    endDate: new Date('2026-12-31T23:59:59+05:30'),
    allowMultipleVotes: false,
    resultsVisible: true,
    studentVotes: students.map((s, i) => ({
      student: s._id,
      selectedOptions: [i % 3],
      votedAt: addHours(addDays(semStart, 90), 9 + i * 7),
    })),
  });

  const qw1 = await QuizWave.create({
    course: course._id,
    title: 'Rational numbers & linear equations — Sprint',
    description: 'Mixed warmup for parent observation day.',
    questions: [
      {
        questionText: 'Which is rational?',
        questionType: 'multiple-choice',
        options: [
          { text: '√3', isCorrect: false },
          { text: 'π', isCorrect: false },
          { text: '−8/15', isCorrect: true },
          { text: '0.1010010001… (gaps grow)', isCorrect: false },
        ],
        points: 4,
        order: 0,
        timeLimit: 25,
      },
      {
        questionText: 'Solution of 5x − 2 = 3x + 8',
        questionType: 'multiple-choice',
        options: [
          { text: 'x = 3', isCorrect: false },
          { text: 'x = 5', isCorrect: true },
          { text: 'x = 4', isCorrect: false },
          { text: 'x = 6', isCorrect: false },
        ],
        points: 4,
        order: 1,
        timeLimit: 25,
      },
      {
        questionText: 'True or false: Sum of exterior angles of any convex polygon is 360°.',
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
    settings: { showLeaderboard: true, showCorrectAnswer: true, maxSessionDuration: 45 },
    createdBy: teacher._id,
    isActive: true,
  });

  const qw2 = await QuizWave.create({
    course: course._id,
    title: 'Mensuration & percentages — Sprint',
    description: 'Volume and commercial arithmetic quick review.',
    questions: [
      {
        questionText: 'Volume of a cylinder with r = 1 cm, h = 10 cm (use π as symbol)?',
        questionType: 'multiple-choice',
        options: [
          { text: '10π cm³', isCorrect: true },
          { text: '20π cm³', isCorrect: false },
          { text: '100π cm³', isCorrect: false },
          { text: '1π cm³', isCorrect: false },
        ],
        points: 4,
        order: 0,
        timeLimit: 30,
      },
      {
        questionText: '10% discount on ₹400 then 5% GST on discounted price — final price?',
        questionType: 'multiple-choice',
        options: [
          { text: '₹378', isCorrect: true },
          { text: '₹380', isCorrect: false },
          { text: '₹360', isCorrect: false },
          { text: '₹400', isCorrect: false },
        ],
        points: 5,
        order: 1,
        timeLimit: 35,
      },
    ],
    settings: { showLeaderboard: true, showCorrectAnswer: true, maxSessionDuration: 40 },
    createdBy: teacher._id,
    isActive: true,
  });

  const groupSet = await GroupSet.create({
    name: 'Term project — Data stories',
    course: course._id,
    allowSelfSignup: false,
    groupStructure: 'manual',
  });

  const mkGroupId = (label) =>
    `math8-demo-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const g1 = await Group.create({
    name: 'Team A — Transport',
    groupSet: groupSet._id,
    course: course._id,
    members: [students[0]._id, students[1]._id],
    leader: students[0]._id,
    groupId: mkGroupId('team-a'),
  });
  const g2 = await Group.create({
    name: 'Team B — Health',
    groupSet: groupSet._id,
    course: course._id,
    members: [students[2]._id, students[3]._id],
    leader: students[2]._id,
    groupId: mkGroupId('team-b'),
  });
  const g3 = await Group.create({
    name: 'Team C — Environment',
    groupSet: groupSet._id,
    course: course._id,
    members: [students[4]._id, students[5]._id],
    leader: students[4]._id,
    groupId: mkGroupId('team-c'),
  });

  const dataModule = moduleDocs.find((m) => m.spec.title === 'Data Handling').mod;
  const groupProjectAvail = addDays(semStart, 52);
  const groupProjectDue = addDays(semStart, 88);

  const groupAssignment = await Assignment.create({
    title: 'Group project — Data story poster (histogram + interpretation)',
    description: `<p>Work with your assigned team. Deliverables: (1) cleaned frequency table, (2) histogram with correct density if intervals vary, (3) three bullet insights, (4) one limitation of the data.</p><p>Submit as one group response before the due date.</p>`,
    availableFrom: groupProjectAvail,
    dueDate: groupProjectDue,
    createdBy: teacher._id,
    questions: [
      {
        id: 'g1',
        type: 'text',
        text: 'Paste your team’s final summary (max 400 words) and list each member’s main contribution.',
        points: 30,
      },
    ],
    published: true,
    isGroupAssignment: true,
    groupSet: groupSet._id,
    isOfflineAssignment: true,
    totalPoints: 30,
    allowStudentUploads: true,
  });

  await Thread.create({
    title: 'Group project — clarifications',
    content: `<p>Ask logistics questions here (datasets, meeting times). Technical mathematics questions should go in the Data Handling module discussion.</p>`,
    course: course._id,
    module: dataModule._id,
    groupSet: groupSet._id,
    author: teacher._id,
    published: true,
    lastActivity: addDays(semStart, 54),
    group: 'Discussions',
  });

  await GroupMeeting.create({
    group: null,
    course: course._id,
    createdBy: teacher._id,
    title: 'Whole class — Mid-term revision (graphs & proportions)',
    description: 'We will work through three past-paper items on the shared whiteboard.',
    startTime: addDays(semStart, 56),
    durationMinutes: 50,
    joinUrl: 'https://meet.demo.vidyalms.com/math8-midterm-revision',
    recordingUrl: '',
    provider: 'zoho_meeting',
    status: 'scheduled',
  });

  await GroupMeeting.create({
    group: null,
    course: course._id,
    createdBy: teacher._id,
    title: 'Whole class — Exam countdown Q&A',
    description: 'Open floor for doubts from Chapters 9–15.',
    startTime: addDays(semStart, 118),
    durationMinutes: 45,
    joinUrl: 'https://meet.demo.vidyalms.com/math8-exam-qa',
    provider: 'zoho_meeting',
    status: 'scheduled',
  });

  await GroupMeeting.create({
    group: g1._id,
    course: course._id,
    createdBy: teacher._id,
    title: 'Team A mentor check-in',
    description: '15 minutes to confirm dataset sources and axis labels.',
    startTime: addDays(semStart, 60),
    durationMinutes: 20,
    joinUrl: 'https://meet.demo.vidyalms.com/math8-team-a',
    provider: 'zoho_meeting',
    status: 'scheduled',
  });

  for (const { qz, spec, index: modIdx } of assignmentPairs) {
    const quizQs = toMcQuestions(spec.quiz);
    const { missing, late } = pickMissingAndLate(modIdx, students.length);
    for (let si = 0; si < students.length; si++) {
      if (missing.has(si)) continue;
      const st = students[si];
      const jitter = (si + modIdx) % 4 === 0 ? 1 : 0;
      const answers = {};
      let earned = 0;
      quizQs.forEach((q, i) => {
        const correctText = q.options.find((o) => o.isCorrect).text;
        if (i < quizQs.length - jitter) {
          answers[String(i)] = correctText;
          earned += q.points || 0;
        } else {
          const wrong = q.options.find((o) => !o.isCorrect);
          answers[String(i)] = wrong.text;
        }
      });
      const autoQ = buildMcAutoQuestionGrades(quizQs, answers);
      let submittedAt;
      if (late.has(si)) {
        submittedAt = addHours(addDays(qz.dueDate, 1 + (si % 2)), 15 + si * 2);
      } else {
        submittedAt = addMinutes(addHours(addDays(qz.availableFrom, 2 + (si % 4)), 16 + si), 20 + si * 11);
      }
      const gradedAt = addHours(submittedAt, 8 + (si % 5));
      await Submission.create({
        assignment: qz._id,
        student: st._id,
        submittedBy: st._id,
        answers,
        submittedAt,
        autoGraded: true,
        autoGrade: earned,
        autoQuestionGrades: autoQ,
        teacherApproved: true,
        finalGrade: earned,
        grade: earned,
        gradedBy: teacher._id,
        gradedAt,
      });
    }
  }

  const hwManualGrades = [18, 20, 16, 19, 17, 20];
  for (let i = 0; i < assignmentPairs.length; i++) {
    const { hw, spec } = assignmentPairs[i];
    const pts = sumQuestionPoints(spec.homework.questions);
    const { missing, late } = pickMissingAndLate(i, students.length);
    for (let si = 0; si < students.length; si++) {
      if (missing.has(si)) continue;
      const st = students[si];
      const g = Math.min(hwManualGrades[si % hwManualGrades.length], pts);
      const questionGrades = allocateQuestionGrades(g, spec.homework.questions);
      let submittedAt;
      if (late.has(si)) {
        submittedAt = addHours(addDays(hw.dueDate, 1 + (si % 3)), 22 + si);
      } else {
        submittedAt = addMinutes(addHours(addDays(hw.availableFrom, 3 + (si % 5)), 17 + si), 40 + si * 13);
      }
      const gradedAt = addHours(submittedAt, 12 + (si % 7));
      await Submission.create({
        assignment: hw._id,
        student: st._id,
        submittedBy: st._id,
        answers: {
          '0': 'Solution attached in notebook; key steps verified in class.',
          '1': 'Used systematic approach as discussed in the module pages.',
          '2': 'Checked answer by substitution / estimation.',
        },
        submittedAt,
        questionGrades,
        grade: g,
        finalGrade: g,
        teacherApproved: true,
        gradedBy: teacher._id,
        gradedAt,
        feedback: 'Strong organisation of work. Continue showing verification line in examinations.',
      });
    }
  }

  const groupQ = groupAssignment.questions;
  await Submission.create({
    assignment: groupAssignment._id,
    student: students[0]._id,
    group: g1._id,
    submittedBy: students[0]._id,
    submissionText:
      'Poster draft: histogram of commute times with 10-minute bins; insights on peak congestion at 8–9 a.m.',
    answers: { g1: 'Team summary: roles split as data collection, plot, write-up.' },
    submittedAt: addHours(addDays(groupProjectDue, -4), 19),
    questionGrades: allocateQuestionGrades(26, groupQ),
    grade: 26,
    finalGrade: 26,
    teacherApproved: true,
    gradedBy: teacher._id,
    gradedAt: addHours(addDays(groupProjectDue, -3), 10),
    feedback: 'Excellent axis labels; add source citation for raw data.',
  });

  await Submission.create({
    assignment: groupAssignment._id,
    student: students[2]._id,
    group: g2._id,
    submittedBy: students[2]._id,
    submissionText:
      'Team B poster: health clinic waiting times; one histogram + dot plot. Still polishing the limitation paragraph.',
    answers: { g1: 'Riya: table; Kabir: plots; joint write-up.' },
    submittedAt: addHours(addDays(groupProjectDue, 2), 20),
    questionGrades: allocateQuestionGrades(24, groupQ),
    grade: 24,
    finalGrade: 24,
    teacherApproved: true,
    gradedBy: teacher._id,
    gradedAt: addHours(addDays(groupProjectDue, 3), 9),
    feedback: 'Late but solid analysis; tighten the axis title on the dot plot.',
  });

  console.log('[seed] Done.', {
    courseId: String(course._id),
    modules: MODULE_SPECS.length,
    quizWaveIds: [String(qw1._id), String(qw2._id)],
    groupSetId: String(groupSet._id),
  });
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[seed] Failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
