/**
 * PeopleSoft SIS adapter — HTTP pull/push with PS-ish default field mappings.
 */
const { pullEntities } = require('./httpPull');
const { mapOutboundRows } = require('./fieldMap');

const DEFAULT_MAPPINGS = {
  users: {
    sis_id: 'emplid',
    email: 'email_addr',
    first_name: 'first_name',
    last_name: 'last_name',
    student_id: 'emplid',
    role: 'role',
  },
  sections: {
    sis_section_id: 'class_nbr',
    course_code: 'catalog_nbr',
    term_code: 'strm',
    section: 'class_section',
    instructor_email: 'instructor_email',
    max_enrollment: 'enrl_cap',
    title: 'course_title_long',
  },
  enrollments: {
    sis_enrollment_id: 'enrl_id',
    sis_section_id: 'class_nbr',
    sis_student_id: 'emplid',
    role: 'role',
    status: 'stdnt_enrl_status',
  },
  grades: {
    sis_student_id: 'emplid',
    sis_section_id: 'class_nbr',
    final_grade: 'crse_grade_off',
    final_percent: 'percent',
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
  return String(config?.credentialsRef || process.env.PEOPLESOFT_SIS_URL || '').trim();
}

function resolveToken(config) {
  return String(config?.apiToken || process.env.PEOPLESOFT_SIS_TOKEN || '').trim();
}

async function pullPeopleSoft({ config, entityTypes, dryRun = false } = {}) {
  const url = resolveUrl(config);
  if (!url) {
    return {
      ok: false,
      message: 'peoplesoft: set credentialsRef or PEOPLESOFT_SIS_URL',
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
      message: 'peoplesoft dry-run pull',
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
  return { ...result, dryRun: false, provider: 'peoplesoft', url };
}

async function pushPeopleSoft({ config, payload, dryRun = true } = {}) {
  const url = resolveUrl(config);
  if (!url) {
    return { ok: false, dryRun: true, message: 'peoplesoft: no credentialsRef / PEOPLESOFT_SIS_URL' };
  }
  const maps = mergeMaps(config);
  const rows = mapOutboundRows(payload?.rows || [], maps.grades);
  if (dryRun || process.env.PEOPLESOFT_SIS_DRY_RUN === 'true') {
    return {
      ok: true,
      dryRun: true,
      url,
      payloadPreview: { count: rows.length },
      message: 'peoplesoft dry-run push',
    };
  }
  const pushUrl = `${url.replace(/\/$/, '')}/grades`;
  const res = await fetch(pushUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(resolveToken(config) ? { Authorization: `Bearer ${resolveToken(config)}` } : {}),
    },
    body: JSON.stringify({ ...payload, rows, provider: 'peoplesoft' }),
  });
  return {
    ok: res.ok,
    dryRun: false,
    status: res.status,
    body: await res.text().catch(() => ''),
    provider: 'peoplesoft',
  };
}

module.exports = { pullPeopleSoft, pushPeopleSoft, DEFAULT_MAPPINGS };
