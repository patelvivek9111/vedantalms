const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const Enrollment = require('../../models/enrollment.model');
const StudentCourseGradeSnapshot = require('../../models/studentCourseGradeSnapshot.model');
const Account = require('../../models/account.model');
const TranscriptIssueLog = require('../../models/transcriptIssueLog.model');
const SystemAuditEvent = require('../../models/systemAuditEvent.model');
const { withTenantFilter } = require('../../utils/tenantContext');
const { calculateGpa } = require('./transcriptGpa.service');

function toCsv(rows, headers) {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

async function loadInstitution(tenantId) {
  return Account.findById(tenantId)
    .select('name code udiseCode affiliationBody institutionMode')
    .lean();
}

/**
 * CBSE-style mark sheet rows for a student/term (FINALIZED/AMENDED only).
 */
async function cbseMarkSheet(tenantId, { studentId, term, year }) {
  const student = await User.findOne(withTenantFilter({ _id: studentId }, tenantId))
    .select('firstName lastName email studentProfile')
    .lean();
  if (!student) {
    const err = new Error('Student not found');
    err.status = 404;
    throw err;
  }

  const snaps = await StudentCourseGradeSnapshot.find({
    student: studentId,
    term,
    year: Number(year),
    frozen: true,
    isCurrent: true,
    lifecycleStatus: { $in: ['FINALIZED', 'AMENDED'] },
  }).lean();

  const courseIds = snaps.map((s) => s.course);
  const courses = courseIds.length
    ? await Course.find({ _id: { $in: courseIds } }).select('title catalog').lean()
    : [];
  const byId = new Map(courses.map((c) => [String(c._id), c]));

  const rows = snaps.map((s) => {
    const c = byId.get(String(s.course));
    return {
      admission_number: student.studentProfile?.admissionNumber || '',
      student_name: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
      subject_code: c?.catalog?.courseCode || '',
      subject_name: c?.title || '',
      theory_marks: s.finalPercent,
      letter_grade: s.letterGrade,
      grade_points: calculateGpa([{ letterGrade: s.letterGrade, creditHours: 1 }], {
        gpaScale: 'cbse_cgpa',
      }).gpa,
      term,
      year: Number(year),
      status: s.lifecycleStatus,
    };
  });

  const headers = [
    'admission_number',
    'student_name',
    'subject_code',
    'subject_name',
    'theory_marks',
    'letter_grade',
    'grade_points',
    'term',
    'year',
    'status',
  ];
  return {
    kind: 'cbse_mark_sheet',
    label: 'CBSE-style mark sheet (export scaffold — not a board-certified form)',
    rows,
    csvText: toCsv(rows, headers),
    count: rows.length,
  };
}

async function classSummary(tenantId, { courseId, term, year }) {
  const course = await Course.findOne(withTenantFilter({ _id: courseId }, tenantId)).lean();
  if (!course) {
    const err = new Error('Course not found');
    err.status = 404;
    throw err;
  }
  const filter = {
    course: courseId,
    frozen: true,
    isCurrent: true,
    lifecycleStatus: { $in: ['FINALIZED', 'AMENDED'] },
  };
  if (term) filter.term = term;
  if (year) filter.year = Number(year);

  const snaps = await StudentCourseGradeSnapshot.find(filter).lean();
  const studentIds = snaps.map((s) => s.student);
  const students = studentIds.length
    ? await User.find({ _id: { $in: studentIds } }).select('firstName lastName email studentProfile').lean()
    : [];
  const byId = new Map(students.map((u) => [String(u._id), u]));

  const rows = snaps.map((s) => {
    const u = byId.get(String(s.student));
    return {
      course_code: course.catalog?.courseCode || '',
      course_title: course.title,
      admission_number: u?.studentProfile?.admissionNumber || '',
      student_name: u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '',
      email: u?.email || '',
      final_percent: s.finalPercent,
      letter_grade: s.letterGrade,
      status: s.lifecycleStatus,
    };
  });
  const headers = [
    'course_code',
    'course_title',
    'admission_number',
    'student_name',
    'email',
    'final_percent',
    'letter_grade',
    'status',
  ];
  return {
    kind: 'class_summary',
    label: 'Class summary',
    rows,
    csvText: toCsv(rows, headers),
    count: rows.length,
  };
}

async function udiseExtract(tenantId) {
  const inst = await loadInstitution(tenantId);
  const students = await User.find(withTenantFilter({ role: 'student' }, tenantId))
    .select('firstName lastName email studentProfile accountId')
    .limit(5000)
    .lean();

  const rows = students.map((s) => ({
    udise_code: inst?.udiseCode || '',
    institution_name: inst?.name || '',
    admission_number: s.studentProfile?.admissionNumber || '',
    student_id: s.studentProfile?.studentId || '',
    first_name: s.firstName || '',
    last_name: s.lastName || '',
    email: s.email || '',
    batch: s.studentProfile?.batch || '',
    current_year: s.studentProfile?.currentYear ?? '',
    division: s.studentProfile?.division || '',
    sis_id: s.studentProfile?.externalIds?.sis || '',
  }));
  const headers = [
    'udise_code',
    'institution_name',
    'admission_number',
    'student_id',
    'first_name',
    'last_name',
    'email',
    'batch',
    'current_year',
    'division',
    'sis_id',
  ];
  return {
    kind: 'udise_extract',
    label: 'UDISE-ready student extract (file export only — not a portal submission)',
    rows,
    csvText: toCsv(rows, headers),
    count: rows.length,
  };
}

async function universityExamForm(tenantId, { term, year }) {
  const snaps = await StudentCourseGradeSnapshot.find({
    term,
    year: Number(year),
    frozen: true,
    isCurrent: true,
    lifecycleStatus: { $in: ['FINALIZED', 'AMENDED'] },
  })
    .limit(5000)
    .lean();

  const studentIds = [...new Set(snaps.map((s) => String(s.student)))];
  const courseIds = [...new Set(snaps.map((s) => String(s.course)))];
  const [students, courses] = await Promise.all([
    User.find({ _id: { $in: studentIds } }).select('firstName lastName studentProfile').lean(),
    Course.find({ _id: { $in: courseIds } }).select('title catalog').lean(),
  ]);
  const sMap = new Map(students.map((u) => [String(u._id), u]));
  const cMap = new Map(courses.map((c) => [String(c._id), c]));

  const rows = snaps.map((snap) => {
    const s = sMap.get(String(snap.student));
    const c = cMap.get(String(snap.course));
    return {
      exam_term: term,
      exam_year: Number(year),
      university_roll: s?.studentProfile?.studentId || s?.studentProfile?.admissionNumber || '',
      student_name: s ? `${s.firstName || ''} ${s.lastName || ''}`.trim() : '',
      paper_code: c?.catalog?.courseCode || '',
      paper_title: c?.title || '',
      marks: snap.finalPercent,
      grade: snap.letterGrade,
    };
  });
  const headers = [
    'exam_term',
    'exam_year',
    'university_roll',
    'student_name',
    'paper_code',
    'paper_title',
    'marks',
    'grade',
  ];
  return {
    kind: 'university_exam_form',
    label: 'University exam form extract (scaffold)',
    rows,
    csvText: toCsv(rows, headers),
    count: rows.length,
  };
}

async function sgpaCgpaStatement(tenantId, { studentId, term, year }) {
  const student = await User.findOne(withTenantFilter({ _id: studentId }, tenantId))
    .select('firstName lastName studentProfile')
    .lean();
  if (!student) {
    const err = new Error('Student not found');
    err.status = 404;
    throw err;
  }

  const snaps = await StudentCourseGradeSnapshot.find({
    student: studentId,
    frozen: true,
    isCurrent: true,
    lifecycleStatus: { $in: ['FINALIZED', 'AMENDED'] },
  }).lean();

  const courseIds = snaps.map((s) => s.course);
  const courses = courseIds.length
    ? await Course.find({ _id: { $in: courseIds } }).select('catalog title').lean()
    : [];
  const cMap = new Map(courses.map((c) => [String(c._id), c]));

  const termRows = snaps.filter((s) => s.term === term && Number(s.year) === Number(year));
  const toGpaRows = (list) =>
    list.map((s) => ({
      letterGrade: s.letterGrade,
      creditHours: cMap.get(String(s.course))?.catalog?.creditHours || 1,
      courseCode: cMap.get(String(s.course))?.catalog?.courseCode || '',
    }));

  const sgpa = calculateGpa(toGpaRows(termRows), { gpaScale: 'india_10' });
  const cgpa = calculateGpa(toGpaRows(snaps), { gpaScale: 'india_10' });

  const rows = [
    {
      student_name: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
      admission_number: student.studentProfile?.admissionNumber || '',
      term,
      year: Number(year),
      sgpa: sgpa.gpa,
      cgpa: cgpa.gpa,
      term_credits: sgpa.totalCredits,
      cumulative_credits: cgpa.totalCredits,
      scale: 'india_10',
    },
  ];
  const headers = [
    'student_name',
    'admission_number',
    'term',
    'year',
    'sgpa',
    'cgpa',
    'term_credits',
    'cumulative_credits',
    'scale',
  ];
  return {
    kind: 'sgpa_cgpa_statement',
    label: 'SGPA / CGPA statement',
    rows,
    csvText: toCsv(rows, headers),
    count: 1,
    detail: { sgpa, cgpa },
  };
}

async function naacEvidencePack(tenantId, { term, year }) {
  const [finalizedSnaps, issues, audits] = await Promise.all([
    StudentCourseGradeSnapshot.countDocuments({
      term,
      year: Number(year),
      frozen: true,
      isCurrent: true,
      lifecycleStatus: { $in: ['FINALIZED', 'AMENDED'] },
    }),
    TranscriptIssueLog.countDocuments(withTenantFilter({ term, year: Number(year) }, tenantId)),
    SystemAuditEvent.countDocuments({
      action: { $in: ['registrar.grades.finalized', 'registrar.transcript.issued', 'registrar.sis.grades_exported'] },
      'metadata.term': term,
    }).catch(() => 0),
  ]);

  const enrollments = await Enrollment.countDocuments(
    withTenantFilter({ status: { $in: ['active', 'completed'] } }, tenantId)
  );

  const rows = [
    {
      evidence_item: 'finalized_grade_snapshots',
      term,
      year: Number(year),
      count: finalizedSnaps,
      notes: 'Official grade freeze count for term',
    },
    {
      evidence_item: 'official_transcripts_issued',
      term,
      year: Number(year),
      count: issues,
      notes: 'TranscriptIssueLog rows',
    },
    {
      evidence_item: 'active_completed_enrollments',
      term: '',
      year: '',
      count: enrollments,
      notes: 'Tenant enrollment of record',
    },
    {
      evidence_item: 'registrar_audit_events_sample',
      term,
      year: Number(year),
      count: audits,
      notes: 'Finalize / issue / SIS export audits (best-effort)',
    },
  ];
  const headers = ['evidence_item', 'term', 'year', 'count', 'notes'];
  return {
    kind: 'naac_evidence_pack',
    label: 'NAAC evidence pack (counts export — not a complete SSR)',
    rows,
    csvText: toCsv(rows, headers),
    count: rows.length,
  };
}

const REPORT_KINDS = {
  'cbse-mark-sheet': cbseMarkSheet,
  'class-summary': classSummary,
  'udise-extract': udiseExtract,
  'university-exam-form': universityExamForm,
  'sgpa-cgpa': sgpaCgpaStatement,
  'naac-evidence': naacEvidencePack,
};

async function runIndiaReport(kind, tenantId, params) {
  const fn = REPORT_KINDS[kind];
  if (!fn) {
    const err = new Error(`Unknown India report: ${kind}`);
    err.status = 400;
    throw err;
  }
  return fn(tenantId, params || {});
}

module.exports = {
  REPORT_KINDS: Object.keys(REPORT_KINDS),
  runIndiaReport,
  cbseMarkSheet,
  classSummary,
  udiseExtract,
  universityExamForm,
  sgpaCgpaStatement,
  naacEvidencePack,
};
