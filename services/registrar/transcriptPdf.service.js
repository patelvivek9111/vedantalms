const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const LOCALE_STRINGS = {
  en: {
    defaultTitle: 'Official Academic Transcript',
    student: 'Student',
    email: 'Email',
    admission: 'Admission #',
    term: 'Term',
    issued: 'Issued',
    courses: 'Courses',
    gpa: 'GPA',
    totalCredits: 'Total credits (weighted)',
    legend: 'Grading scale legend',
    hash: 'Transcript hash',
    verify: 'Verify',
  },
  hi: {
    defaultTitle: 'Official Academic Transcript / आधिकारिक शैक्षणिक ट्रांसक्रिप्ट',
    student: 'Student / विद्यार्थी',
    email: 'Email / ईमेल',
    admission: 'Admission # / प्रवेश संख्या',
    term: 'Term / सत्र',
    issued: 'Issued / जारी तिथि',
    courses: 'Courses / पाठ्यक्रम',
    gpa: 'GPA / जीपीए',
    totalCredits: 'Total credits / कुल क्रेडिट',
    legend: 'Grading scale / ग्रेडिंग स्केल',
    hash: 'Transcript hash',
    verify: 'Verify / सत्यापन',
  },
};

/**
 * Render an official transcript PDF buffer with optional QR linking to verify URL.
 */
async function renderOfficialTranscriptPdf({
  student,
  term,
  year,
  courses,
  gpaSummary,
  transcriptHash,
  verifyUrl,
  template,
}) {
  const locale = template?.locale === 'hi' ? 'hi' : 'en';
  const S = LOCALE_STRINGS[locale];
  const layout = template?.layoutConfig || {};
  const title = layout.title || S.defaultTitle;
  const includes = new Set(template?.includes || ['gpa', 'credits', 'grading_scale_legend']);
  const showQr = layout.showQr !== false && Boolean(verifyUrl);

  let qrPng = null;
  if (showQr) {
    qrPng = await QRCode.toBuffer(verifyUrl, { type: 'png', width: 128, margin: 1 });
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(title, { align: 'center' });
    doc.moveDown(0.5);
    (layout.headerLines || []).forEach((line) => {
      doc.fontSize(10).text(String(line), { align: 'center' });
    });
    doc.moveDown();

    doc.fontSize(11).text(`${S.student}: ${student.firstName || ''} ${student.lastName || ''}`.trim());
    if (student.email) doc.text(`${S.email}: ${student.email}`);
    if (student.studentProfile?.admissionNumber) {
      doc.text(`${S.admission}: ${student.studentProfile.admissionNumber}`);
    }
    doc.text(`${S.term}: ${term} ${year}`);
    doc.text(`${S.issued}: ${new Date().toISOString().slice(0, 10)}`);
    doc.moveDown();

    doc.fontSize(12).text(S.courses, { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(9);
    for (const c of courses) {
      const code = c.courseCode || c.courseId;
      const titleText = c.title || '';
      const letter = c.letterGrade ?? '—';
      const pct = c.finalPercent != null ? `${c.finalPercent}%` : '—';
      const credits = includes.has('credits') && c.creditHours != null ? ` · ${c.creditHours} cr` : '';
      doc.text(`${code}  ${titleText}  ${letter} (${pct})${credits}`);
    }

    if (includes.has('gpa') && gpaSummary) {
      doc.moveDown();
      doc.fontSize(11).text(`${S.gpa} (${gpaSummary.scaleLabel}): ${gpaSummary.gpa}`);
      if (includes.has('credits')) {
        doc.fontSize(10).text(`${S.totalCredits}: ${gpaSummary.totalCredits}`);
      }
    }

    if (includes.has('grading_scale_legend') && gpaSummary?.legend?.length) {
      doc.moveDown();
      doc.fontSize(10).text(S.legend, { underline: true });
      doc.fontSize(8).text(
        gpaSummary.legend.map((e) => `${e.letter}=${e.points}`).join('  '),
        { width: 500 }
      );
    }

    doc.moveDown();
    doc.fontSize(8).fillColor('#333').text(`${S.hash}: ${transcriptHash}`);
    if (verifyUrl) {
      doc.text(`${S.verify}: ${verifyUrl}`);
    }

    if (qrPng) {
      doc.image(qrPng, doc.page.width - 50 - 100, doc.y, { width: 80 });
    }

    doc.moveDown(2);
    (layout.footerLines || []).forEach((line) => {
      doc.fontSize(8).fillColor('#555').text(String(line));
    });

    doc.end();
  });
}

module.exports = { renderOfficialTranscriptPdf, LOCALE_STRINGS };
