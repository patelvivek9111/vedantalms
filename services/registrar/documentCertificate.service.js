const PDFDocument = require('pdfkit');
const User = require('../../models/user.model');
const Enrollment = require('../../models/enrollment.model');
const Course = require('../../models/course.model');
const Account = require('../../models/account.model');
const { withTenantFilter } = require('../../utils/tenantContext');

const LABELS = {
  en: {
    bonafideTitle: 'Bonafide Certificate',
    tcTitle: 'Transfer / Migration Certificate',
    certify: 'This is to certify that',
    isStudent: 'is / was a bona fide student of',
    enrolledIn: 'Enrolled courses',
    issuedOn: 'Issued on',
    registrar: 'Registrar / Principal',
    leaving: 'is hereby granted this Transfer / Migration Certificate.',
    lastAttended: 'Last attended',
  },
  hi: {
    bonafideTitle: 'बोनाफाइड प्रमाण पत्र',
    tcTitle: 'स्थानांतरण / माइग्रेशन प्रमाण पत्र',
    certify: 'प्रमाणित किया जाता है कि',
    isStudent: 'इस संस्था के सद्भावना छात्र / छात्रा हैं / थे',
    enrolledIn: 'नामांकित पाठ्यक्रम',
    issuedOn: 'जारी तिथि',
    registrar: 'रजिस्ट्रार / प्राचार्य',
    leaving: 'को यह स्थानांतरण / माइग्रेशन प्रमाण पत्र प्रदान किया जाता है।',
    lastAttended: 'अंतिम उपस्थिति',
  },
};

function renderPdf(lines) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    for (const line of lines) {
      if (line.type === 'title') {
        doc.fontSize(16).text(line.text, { align: 'center' });
        doc.moveDown();
      } else if (line.type === 'spacer') {
        doc.moveDown(line.n || 1);
      } else {
        doc.fontSize(line.size || 11).text(line.text, { align: line.align || 'left' });
      }
    }
    doc.end();
  });
}

async function loadContext(tenantId, studentId) {
  const [student, institution, enrollments] = await Promise.all([
    User.findOne(withTenantFilter({ _id: studentId }, tenantId))
      .select('firstName lastName email studentProfile')
      .lean(),
    Account.findById(tenantId).select('name code affiliationBody udiseCode').lean(),
    Enrollment.find(
      withTenantFilter(
        { studentId, status: { $in: ['active', 'completed'] }, role: 'student' },
        tenantId
      )
    )
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean(),
  ]);
  if (!student) {
    const err = new Error('Student not found');
    err.status = 404;
    throw err;
  }
  const courseIds = enrollments.map((e) => e.lmsCourseId).filter(Boolean);
  const courses = courseIds.length
    ? await Course.find({ _id: { $in: courseIds } }).select('title catalog').lean()
    : [];
  return { student, institution, enrollments, courses };
}

async function renderBonafidePdf({ tenantId, studentId, locale = 'en', notes }) {
  const L = LABELS[locale] || LABELS.en;
  const { student, institution, courses } = await loadContext(tenantId, studentId);
  const name = `${student.firstName || ''} ${student.lastName || ''}`.trim();
  const admission = student.studentProfile?.admissionNumber || student.studentProfile?.studentId || '—';
  const instName = institution?.name || 'the Institution';

  const lines = [
    { type: 'title', text: L.bonafideTitle },
    { type: 'text', text: institution?.affiliationBody || '', align: 'center', size: 9 },
    { type: 'spacer', n: 1 },
    { type: 'text', text: `${L.certify} ${name} (Admission / ID: ${admission})` },
    { type: 'text', text: `${L.isStudent} ${instName}.` },
    { type: 'spacer' },
    { type: 'text', text: `${L.enrolledIn}:` },
    ...courses.slice(0, 12).map((c) => ({
      type: 'text',
      text: `• ${(c.catalog?.courseCode || '').toString()} ${c.title || ''}`.trim(),
      size: 10,
    })),
  ];
  if (notes) lines.push({ type: 'spacer' }, { type: 'text', text: String(notes), size: 10 });
  lines.push(
    { type: 'spacer', n: 2 },
    { type: 'text', text: `${L.issuedOn}: ${new Date().toISOString().slice(0, 10)}` },
    { type: 'spacer', n: 2 },
    { type: 'text', text: L.registrar }
  );

  const pdfBuffer = await renderPdf(lines);
  return {
    type: 'bonafide',
    locale,
    pdfBase64: pdfBuffer.toString('base64'),
    studentName: name,
    admissionNumber: admission,
  };
}

async function renderMigrationTcPdf({ tenantId, studentId, locale = 'en', notes }) {
  const L = LABELS[locale] || LABELS.en;
  const { student, institution, enrollments, courses } = await loadContext(tenantId, studentId);
  const name = `${student.firstName || ''} ${student.lastName || ''}`.trim();
  const admission = student.studentProfile?.admissionNumber || student.studentProfile?.studentId || '—';
  const last = enrollments[0];
  const lastCourse = courses.find((c) => String(c._id) === String(last?.lmsCourseId));

  const lines = [
    { type: 'title', text: L.tcTitle },
    { type: 'text', text: institution?.name || '', align: 'center', size: 11 },
    { type: 'spacer', n: 1 },
    { type: 'text', text: `${L.certify} ${name} (Admission / ID: ${admission})` },
    { type: 'text', text: L.leaving },
    {
      type: 'text',
      text: `${L.lastAttended}: ${lastCourse?.catalog?.courseCode || ''} ${lastCourse?.title || ''} (${last?.status || 'n/a'})`,
    },
  ];
  if (notes) lines.push({ type: 'spacer' }, { type: 'text', text: String(notes), size: 10 });
  lines.push(
    { type: 'spacer', n: 2 },
    { type: 'text', text: `${L.issuedOn}: ${new Date().toISOString().slice(0, 10)}` },
    { type: 'spacer', n: 2 },
    { type: 'text', text: L.registrar }
  );

  const pdfBuffer = await renderPdf(lines);
  return {
    type: 'migration_tc',
    locale,
    pdfBase64: pdfBuffer.toString('base64'),
    studentName: name,
    admissionNumber: admission,
  };
}

module.exports = {
  LABELS,
  renderBonafidePdf,
  renderMigrationTcPdf,
};
