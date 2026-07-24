/**
 * Fedena / common India SIS adapter — same pluggable HTTP interface.
 */
const { pullEntities } = require('./httpPull');
const { mapOutboundRows } = require('./fieldMap');

const DEFAULT_MAPPINGS = {
  users: {
    sis_id: 'admission_no',
    email: 'email',
    first_name: 'first_name',
    last_name: 'last_name',
    student_id: 'admission_no',
    role: 'role',
    program: 'batch_name',
  },
  sections: {
    sis_section_id: 'subject_id',
    course_code: 'code',
    term_code: 'academic_year',
    section: 'section_name',
    instructor_email: 'employee_email',
    max_enrollment: 'max_students',
    title: 'name',
  },
  enrollments: {
    sis_enrollment_id: 'student_subject_id',
    sis_section_id: 'subject_id',
    sis_student_id: 'admission_no',
    role: 'role',
    status: 'status',
  },
  grades: {
    sis_student_id: 'admission_no',
    sis_section_id: 'subject_id',
    final_grade: 'grade',
    final_percent: 'marks',
  },
};

function mergeMaps(config) {
  const fm = config?.fieldMappings || {};
  return {
    users: { ...DEFAULT_MAPPINGS.users, ...(fm.users || {}) },
    sections: { ...DEFAULT_MAPPINGS.sections, ...(fm.sections || {}) },
    enrollments: { ...DEFAULT_MAPPINGS.enrollments, ...(fm.enrollments || {}) },
    grades: { ...DEFAULT_MAPPINGS.grades, ...(fm.grades || {}) },
  };
}

function resolveUrl(config) {
  return String(config?.credentialsRef || process.env.FEDENA_SIS_URL || '').trim();
}

function resolveToken(config) {
  return String(config?.apiToken || process.env.FEDENA_SIS_TOKEN || '').trim();
}

async function pullFedena({ config, entityTypes, dryRun = false } = {}) {
  const url = resolveUrl(config);
  if (!url) {
    return {
      ok: false,
      message: 'fedena: set credentialsRef or FEDENA_SIS_URL',
      users: [],
      sections: [],
      enrollments: [],
    };
  }
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      url,
      message: 'fedena dry-run pull',
      users: [],
      sections: [],
      enrollments: [],
    };
  }
  const maps = mergeMaps(config);
  const result = await pullEntities({
    baseUrl: url,
    token: resolveToken(config),
    fieldMappings: maps,
    entityTypes: entityTypes || ['users', 'sections', 'enrollments'],
  });
  return { ...result, dryRun: false, provider: 'fedena', url };
}

async function pushFedena({ config, payload, dryRun = true } = {}) {
  const url = resolveUrl(config);
  if (!url) {
    return { ok: false, dryRun: true, message: 'fedena: no credentialsRef / FEDENA_SIS_URL' };
  }
  const maps = mergeMaps(config);
  const rows = mapOutboundRows(payload?.rows || [], maps.grades);
  if (dryRun || process.env.FEDENA_SIS_DRY_RUN === 'true') {
    return {
      ok: true,
      dryRun: true,
      url,
      payloadPreview: { count: rows.length },
      message: 'fedena dry-run push',
    };
  }
  const pushUrl = `${url.replace(/\/$/, '')}/grades`;
  const res = await fetch(pushUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(resolveToken(config) ? { Authorization: `Bearer ${resolveToken(config)}` } : {}),
    },
    body: JSON.stringify({ ...payload, rows, provider: 'fedena' }),
  });
  return {
    ok: res.ok,
    dryRun: false,
    status: res.status,
    body: await res.text().catch(() => ''),
    provider: 'fedena',
  };
}

module.exports = { pullFedena, pushFedena, DEFAULT_MAPPINGS };
