/**
 * Custom REST SIS adapter — pull (import) + push (export).
 * Live POST when dryRun is false and CUSTOM_REST_SIS_DRY_RUN is not forcing dry-run.
 */
const { pullEntities } = require('./httpPull');
const { mapOutboundRows } = require('./fieldMap');

function resolveUrl(config) {
  return String(config?.credentialsRef || process.env.CUSTOM_REST_SIS_URL || '').trim();
}

function resolveToken(config) {
  return String(config?.apiToken || process.env.CUSTOM_REST_SIS_TOKEN || '').trim();
}

function shouldDryRun(dryRun) {
  // Live POST only when dryRun===false AND CUSTOM_REST_SIS_DRY_RUN=false.
  if (process.env.CUSTOM_REST_SIS_DRY_RUN === 'true') return true;
  if (dryRun === false && process.env.CUSTOM_REST_SIS_DRY_RUN === 'false') return false;
  return true;
}

async function pullCustomRest({ config, fieldMappings, entityTypes, dryRun = false } = {}) {
  const url = resolveUrl(config);
  if (!url) {
    return {
      ok: false,
      dryRun: true,
      message: 'custom_rest provider has no credentialsRef / CUSTOM_REST_SIS_URL',
      users: [],
      sections: [],
      enrollments: [],
    };
  }

  if (dryRun && process.env.CUSTOM_REST_SIS_DRY_RUN !== 'false') {
    return {
      ok: true,
      dryRun: true,
      url,
      message: 'Dry-run pull — set dryRun:false or CUSTOM_REST_SIS_DRY_RUN=false to GET',
      users: [],
      sections: [],
      enrollments: [],
    };
  }

  const result = await pullEntities({
    baseUrl: url,
    token: resolveToken(config),
    fieldMappings: fieldMappings || config?.fieldMappings || {},
    entityTypes: entityTypes || ['users', 'sections', 'enrollments'],
  });
  return { ...result, dryRun: false, url, provider: 'custom_rest' };
}

async function pushCustomRest({ config, payload, dryRun = true, fieldMappings } = {}) {
  const url = resolveUrl(config);
  if (!url) {
    return {
      ok: false,
      dryRun: true,
      message: 'custom_rest provider has no credentialsRef / CUSTOM_REST_SIS_URL',
    };
  }

  const mappings = fieldMappings || config?.fieldMappings?.grades || {};
  const rows = Array.isArray(payload?.rows) ? mapOutboundRows(payload.rows, mappings) : payload?.rows;
  const bodyPayload = { ...payload, rows };

  if (shouldDryRun(dryRun)) {
    return {
      ok: true,
      dryRun: true,
      url,
      payloadPreview: {
        entityType: payload?.entityType,
        count: Array.isArray(rows) ? rows.length : 0,
      },
      message: 'Dry-run only — set CUSTOM_REST_SIS_DRY_RUN=false and dryRun:false to POST',
    };
  }

  const pushUrl = url.endsWith('/grades') || url.includes('grades') ? url : `${url.replace(/\/$/, '')}/grades`;
  const res = await fetch(pushUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(resolveToken(config) ? { Authorization: `Bearer ${resolveToken(config)}` } : {}),
    },
    body: JSON.stringify(bodyPayload),
  });

  return {
    ok: res.ok,
    dryRun: false,
    status: res.status,
    body: await res.text().catch(() => ''),
    provider: 'custom_rest',
  };
}

module.exports = { pullCustomRest, pushCustomRest, resolveUrl, shouldDryRun };
