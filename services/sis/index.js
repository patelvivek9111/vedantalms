const SisStagingEnrollment = require('../../models/sisStagingEnrollment.model');
const crypto = require('crypto');

function normalizeRow(provider, row) {
  return {
    provider,
    externalStudentId: String(row.externalStudentId || row.studentId || row.emplid || ''),
    externalCourseId: String(row.externalCourseId || row.courseId || row.crse_id || ''),
    studentEmail: row.studentEmail || row.email || null,
    courseCode: row.courseCode || row.catalogNbr || null,
    term: row.term || null,
    year: row.year ? Number(row.year) : null,
    rawPayload: row,
  };
}

async function stageEnrollmentImport(provider, rows, { batchId } = {}) {
  const id = batchId || crypto.randomBytes(8).toString('hex');
  const docs = rows
    .map((r) => normalizeRow(provider, r))
    .filter((r) => r.externalStudentId && r.externalCourseId);

  if (!docs.length) {
    return { batchId: id, staged: 0 };
  }

  await SisStagingEnrollment.insertMany(
    docs.map((d) => ({ ...d, batchId: id, status: 'pending' }))
  );
  return { batchId: id, staged: docs.length };
}

/** Provider-specific parsers — no direct grade writes. */
const adapters = {
  banner: (rows) => stageEnrollmentImport('banner', rows),
  peoplesoft: (rows) => stageEnrollmentImport('peoplesoft', rows),
  workday: (rows) => stageEnrollmentImport('workday', rows),
  csv: (rows) => stageEnrollmentImport('csv', rows),
};

module.exports = {
  adapters,
  stageEnrollmentImport,
  SisStagingEnrollment,
};
