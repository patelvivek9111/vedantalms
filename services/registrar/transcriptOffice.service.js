const TranscriptTemplate = require('../../models/transcriptTemplate.model');
const TranscriptRequest = require('../../models/transcriptRequest.model');
const User = require('../../models/user.model');
const Enrollment = require('../../models/enrollment.model');
const Course = require('../../models/course.model');
const { withTenantFilter } = require('../../utils/tenantContext');
const transcriptIssuance = require('../transcriptIssuance.service');
const { calculateGpa } = require('./transcriptGpa.service');
const { renderOfficialTranscriptPdf } = require('./transcriptPdf.service');
const academicAuditService = require('../academicAudit.service');

async function listTemplates(tenantId) {
  return TranscriptTemplate.find(withTenantFilter({ isActive: true }, tenantId))
    .sort({ isDefault: -1, name: 1 })
    .lean();
}

async function createTemplate(tenantId, body, accountId) {
  if (body.isDefault) {
    await TranscriptTemplate.updateMany(
      withTenantFilter({}, tenantId),
      { $set: { isDefault: false } }
    );
  }
  return TranscriptTemplate.create({
    name: String(body.name || '').trim(),
    format: body.format || 'pdf',
    locale: body.locale || 'en',
    isDefault: Boolean(body.isDefault),
    includes: Array.isArray(body.includes) ? body.includes : undefined,
    gpaScale: body.gpaScale || 'india_10',
    repeatedCoursePolicy: body.repeatedCoursePolicy || 'highest',
    layoutConfig: body.layoutConfig || undefined,
    rootAccountId: tenantId,
    accountId: accountId || tenantId,
  });
}

async function updateTemplate(tenantId, id, body) {
  const doc = await TranscriptTemplate.findOne(withTenantFilter({ _id: id }, tenantId));
  if (!doc) {
    const err = new Error('Template not found');
    err.status = 404;
    throw err;
  }
  const fields = [
    'name',
    'format',
    'locale',
    'isActive',
    'includes',
    'gpaScale',
    'repeatedCoursePolicy',
    'layoutConfig',
  ];
  for (const f of fields) {
    if (body[f] !== undefined) doc[f] = body[f];
  }
  if (body.isDefault === true) {
    await TranscriptTemplate.updateMany(
      withTenantFilter({ _id: { $ne: doc._id } }, tenantId),
      { $set: { isDefault: false } }
    );
    doc.isDefault = true;
  } else if (body.isDefault === false) {
    doc.isDefault = false;
  }
  await doc.save();
  return doc.toObject();
}

async function getDefaultTemplate(tenantId) {
  const found = await TranscriptTemplate.findOne(
    withTenantFilter({ isDefault: true, isActive: true }, tenantId)
  ).lean();
  if (found) return found;
  return TranscriptTemplate.findOne(withTenantFilter({ isActive: true }, tenantId))
    .sort({ createdAt: 1 })
    .lean();
}

async function listRequests(tenantId, { status, limit = 50 } = {}) {
  const filter = withTenantFilter({}, tenantId);
  if (status) filter.status = status;
  return TranscriptRequest.find(filter)
    .sort({ requestedAt: -1 })
    .limit(Math.min(Number(limit) || 50, 200))
    .populate('studentId', 'firstName lastName email studentProfile.admissionNumber')
    .populate('processedBy', 'firstName lastName email')
    .lean();
}

async function createRequest(tenantId, body, accountId) {
  const student = await User.findOne(
    withTenantFilter({ _id: body.studentId }, tenantId)
  ).select('_id');
  if (!student) {
    const err = new Error('Student not found in tenant');
    err.status = 404;
    throw err;
  }
  return TranscriptRequest.create({
    studentId: body.studentId,
    term: String(body.term || '').trim(),
    year: Number(body.year),
    type: body.type || 'official',
    status: 'pending',
    copies: body.copies || 1,
    deliveryMethod: body.deliveryMethod || 'download',
    feeRef: body.feeRef || '',
    notes: body.notes || '',
    templateId: body.templateId || null,
    rootAccountId: tenantId,
    accountId: accountId || tenantId,
  });
}

async function patchRequest(tenantId, id, body, user) {
  const doc = await TranscriptRequest.findOne(withTenantFilter({ _id: id }, tenantId));
  if (!doc) {
    const err = new Error('Request not found');
    err.status = 404;
    throw err;
  }

  if (body.status === 'approved' || body.status === 'rejected') {
    if (doc.status !== 'pending' && doc.status !== 'approved') {
      const err = new Error(`Cannot move request from ${doc.status} to ${body.status}`);
      err.status = 400;
      throw err;
    }
    doc.status = body.status;
    doc.processedBy = user._id;
    if (body.status === 'rejected') {
      doc.rejectionReason = body.rejectionReason || body.notes || '';
    }
  }

  if (body.notes !== undefined) doc.notes = body.notes;
  if (body.templateId !== undefined) doc.templateId = body.templateId;
  await doc.save();
  return doc.toObject();
}

async function resolveTemplate(tenantId, templateId) {
  if (templateId) {
    const t = await TranscriptTemplate.findOne(
      withTenantFilter({ _id: templateId, isActive: true }, tenantId)
    ).lean();
    if (t) return t;
  }
  return getDefaultTemplate(tenantId);
}

async function issueWithPdf({
  tenantId,
  studentId,
  term,
  year,
  issuedBy,
  notes,
  ip,
  templateId,
  requestId,
}) {
  const template = await resolveTemplate(tenantId, templateId);
  const result = await transcriptIssuance.issueOfficialTranscript({
    studentId,
    term,
    year,
    issuedBy,
    notes,
    ip,
    templateId: template?._id,
    requestId,
  });

  const gpaSummary = calculateGpa(result.payload.courses, {
    gpaScale: template?.gpaScale || 'india_10',
    repeatedCoursePolicy: template?.repeatedCoursePolicy || 'highest',
  });

  const pdfBuffer = await renderOfficialTranscriptPdf({
    student: result.student,
    term,
    year,
    courses: result.payload.courses,
    gpaSummary,
    transcriptHash: result.transcriptHash,
    verifyUrl: result.verifyUrl,
    template: template || {
      includes: ['gpa', 'credits', 'grading_scale_legend'],
      layoutConfig: { title: 'Official Academic Transcript', showQr: true },
    },
  });

  await academicAuditService
    .recordAuditEvent({
      actorId: issuedBy._id || issuedBy,
      entityType: 'transcript_issue',
      entityId: result.log._id,
      action: 'registrar.transcript.issued',
      after: {
        studentId: String(studentId),
        term,
        year: Number(year),
        transcriptHash: result.transcriptHash,
      },
      severity: 'critical',
      rootAccountId: tenantId,
      metadata: { studentId: String(studentId), term, year: Number(year) },
    })
    .catch(() => {});

  if (requestId) {
    await TranscriptRequest.updateOne(
      withTenantFilter({ _id: requestId }, tenantId),
      {
        $set: {
          status: 'issued',
          issuedAt: new Date(),
          processedBy: issuedBy._id || issuedBy,
          issueLogId: result.log._id,
        },
      }
    );
  }

  return {
    ...result,
    gpaSummary,
    pdfBase64: pdfBuffer.toString('base64'),
    templateId: template?._id || null,
  };
}

async function fulfillRequest(tenantId, requestId, user, { ip } = {}) {
  const doc = await TranscriptRequest.findOne(withTenantFilter({ _id: requestId }, tenantId));
  if (!doc) {
    const err = new Error('Request not found');
    err.status = 404;
    throw err;
  }
  if (!['pending', 'approved'].includes(doc.status)) {
    const err = new Error(`Request is already ${doc.status}`);
    err.status = 400;
    throw err;
  }
  if (doc.type === 'bonafide' || doc.type === 'migration_tc') {
    const documentCertificate = require('./documentCertificate.service');
    const TranscriptTemplate = require('../../models/transcriptTemplate.model');
    let locale = 'en';
    if (doc.templateId) {
      const tpl = await TranscriptTemplate.findById(doc.templateId).select('locale').lean();
      if (tpl?.locale) locale = tpl.locale;
    }
    if (doc.status === 'pending') {
      doc.status = 'approved';
      doc.processedBy = user._id;
      await doc.save();
    }
    const cert =
      doc.type === 'bonafide'
        ? await documentCertificate.renderBonafidePdf({
            tenantId,
            studentId: doc.studentId,
            locale,
            notes: doc.notes,
          })
        : await documentCertificate.renderMigrationTcPdf({
            tenantId,
            studentId: doc.studentId,
            locale,
            notes: doc.notes,
          });

    doc.status = 'issued';
    doc.issuedAt = new Date();
    doc.processedBy = user._id;
    await doc.save();

    return {
      certificate: true,
      type: doc.type,
      locale,
      pdfBase64: cert.pdfBase64,
      studentName: cert.studentName,
      requestId: doc._id,
      log: { _id: doc._id, type: doc.type, status: 'issued' },
      transcriptHash: null,
      verifyUrl: null,
      payload: { courses: [] },
      gpaSummary: null,
      templateId: doc.templateId || null,
    };
  }

  if (doc.type !== 'official' && doc.type !== 'unofficial') {
    const err = new Error(`Unsupported request type: ${doc.type}`);
    err.status = 400;
    throw err;
  }

  if (doc.status === 'pending') {
    doc.status = 'approved';
    doc.processedBy = user._id;
    await doc.save();
  }

  return issueWithPdf({
    tenantId,
    studentId: doc.studentId,
    term: doc.term,
    year: doc.year,
    issuedBy: user,
    notes: doc.notes,
    ip,
    templateId: doc.templateId,
    requestId: doc._id,
  });
}

/**
 * Students with active/completed enrollments in courses linked to term label+year.
 */
async function previewBulkIssue(tenantId, { term, year, studentIds } = {}) {
  let ids = Array.isArray(studentIds) ? studentIds.map(String) : null;

  if (!ids?.length) {
    const courses = await Course.find(
      withTenantFilter(
        {
          published: true,
          'semester.term': term,
          'semester.year': Number(year),
        },
        tenantId
      )
    )
      .select('_id students')
      .lean();

    const courseIds = courses.map((c) => c._id);
    const fromEnrollment = courseIds.length
      ? await Enrollment.find(
          withTenantFilter(
            {
              lmsCourseId: { $in: courseIds },
              role: 'student',
              status: { $in: ['active', 'completed'] },
            },
            tenantId
          )
        )
          .select('studentId')
          .lean()
      : [];

    const set = new Set(fromEnrollment.map((e) => String(e.studentId)));
    for (const c of courses) {
      for (const s of c.students || []) set.add(String(s));
    }
    ids = [...set];
  }

  const preview = [];
  for (const studentId of ids) {
    try {
      const payload = await transcriptIssuance.buildTranscriptHashPayload(studentId, term, year, {
        rootAccountId: tenantId,
      });
      try {
        transcriptIssuance.assertOfficialEligible(payload);
        preview.push({
          studentId,
          ok: true,
          courseCount: payload.courses.length,
        });
      } catch (err) {
        preview.push({
          studentId,
          ok: false,
          message: err.message,
          code: err.code,
          courseCount: payload.courses.length,
        });
      }
    } catch (err) {
      preview.push({ studentId, ok: false, message: err.message });
    }
  }

  return {
    term,
    year: Number(year),
    total: preview.length,
    ready: preview.filter((p) => p.ok).length,
    blocked: preview.filter((p) => !p.ok).length,
    rows: preview,
    readyStudentIds: preview.filter((p) => p.ok).map((p) => p.studentId),
  };
}

async function bulkIssueSync({ tenantId, term, year, studentIds, issuedBy, notes, ip, templateId }) {
  const results = [];
  for (const studentId of studentIds) {
    try {
      const issued = await issueWithPdf({
        tenantId,
        studentId,
        term,
        year,
        issuedBy,
        notes,
        ip,
        templateId,
      });
      results.push({
        studentId,
        ok: true,
        transcriptHash: issued.transcriptHash,
        issueLogId: issued.log._id,
        // omit pdfBase64 in bulk aggregate to keep payload small
      });
    } catch (err) {
      results.push({ studentId, ok: false, message: err.message, code: err.code });
    }
  }
  return {
    term,
    year: Number(year),
    issued: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

module.exports = {
  listTemplates,
  createTemplate,
  updateTemplate,
  getDefaultTemplate,
  listRequests,
  createRequest,
  patchRequest,
  issueWithPdf,
  fulfillRequest,
  previewBulkIssue,
  bulkIssueSync,
};
