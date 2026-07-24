/**
 * Banner SIS adapter — HTTP pull/push with Banner-ish default field mappings.
 * Partner supplies credentialsRef (base URL) + optional fieldMappings override.
 */
const { pullEntities } = require('./httpPull');
const { mapOutboundRows } = require('./fieldMap');

const DEFAULT_MAPPINGS = {
  users: {
    sis_id: 'bannerId',
    email: 'emailAddress',
    first_name: 'firstName',
    last_name: 'lastName',
    student_id: 'spridenId',
    role: 'role',
  },
  sections: {
    sis_section_id: 'crn',
    course_code: 'subjCourse',
    term_code: 'termCode',
    section: 'seqNumber',
    instructor_email: 'instructorEmail',
    max_enrollment: 'maxEnroll',
    title: 'courseTitle',
  },
  enrollments: {
    sis_enrollment_id: 'enrollId',
    sis_section_id: 'crn',
    sis_student_id: 'bannerId',
    role: 'role',
    status: 'enrollStatus',
  },
  grades: {
    sis_student_id: 'bannerId',
    sis_section_id: 'crn',
    final_grade: 'grade',
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
  return String(config?.credentialsRef || process.env.BANNER_SIS_URL || '').trim();
}

function resolveToken(config) {
  return String(config?.apiToken || process.env.BANNER_SIS_TOKEN || '').trim();
}

async function pullBanner({ config, entityTypes, dryRun = false } = {}) {
  const url = resolveUrl(config);
  if (!url) {
    return {
      ok: false,
      message: 'banner: set credentialsRef or BANNER_SIS_URL',
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
      message: 'banner dry-run pull',
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
  return { ...result, dryRun: false, provider: 'banner', url };
}

async function pushBanner({ config, payload, dryRun = true } = {}) {
  const url = resolveUrl(config);
  if (!url) {
    return { ok: false, dryRun: true, message: 'banner: no credentialsRef / BANNER_SIS_URL' };
  }
  const maps = mergeMaps(config);
  const rows = mapOutboundRows(payload?.rows || [], maps.grades);
  if (dryRun || process.env.BANNER_SIS_DRY_RUN === 'true') {
    return {
      ok: true,
      dryRun: true,
      url,
      payloadPreview: { count: rows.length },
      message: 'banner dry-run push',
    };
  }
  const pushUrl = `${url.replace(/\/$/, '')}/grades`;
  const res = await fetch(pushUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(resolveToken(config) ? { Authorization: `Bearer ${resolveToken(config)}` } : {}),
    },
    body: JSON.stringify({ ...payload, rows, provider: 'banner' }),
  });
  return {
    ok: res.ok,
    dryRun: false,
    status: res.status,
    body: await res.text().catch(() => ''),
    provider: 'banner',
  };
}

module.exports = { pullBanner, pushBanner, DEFAULT_MAPPINGS };
