/**
 * LTI 1.3 Assignment and Grade Services (AGS) — line items + score passback.
 * Uses OAuth2 client-credentials against the platform token URL when configured.
 */
const crypto = require('crypto');
const GradePassbackRecord = require('../../models/gradePassbackRecord.model');
const LtiPlatformConfig = require('../../models/ltiPlatformConfig.model');
const LtiLineItem = require('../../models/ltiLineItem.model');
const User = require('../../models/user.model');
const { withTenantFilter } = require('../../utils/tenantContext');
const { getLtiConfig, validateLaunchPayload } = require('./ltiReadiness.service');

const AGS_SCOPES = [
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
];

let cachedToken = { accessToken: null, expiresAt: 0, key: '' };

function isAgsEnabled(cfg) {
  if (cfg && typeof cfg.agsEnabled === 'boolean') return cfg.agsEnabled;
  return process.env.LTI_AGS_ENABLED === 'true';
}

function envPlatformDefaults() {
  return {
    issuer: process.env.LTI_ISSUER || '',
    clientId: process.env.LTI_CLIENT_ID || '',
    clientSecret: process.env.LTI_CLIENT_SECRET || '',
    deploymentId: process.env.LTI_DEPLOYMENT_ID || '',
    jwksUrl: process.env.LTI_JWKS_URL || '',
    tokenUrl: process.env.LTI_AGS_TOKEN_URL || process.env.LTI_TOKEN_URL || '',
    lineItemsUrl: process.env.LTI_AGS_LINEITEMS_URL || '',
    scopes: AGS_SCOPES,
    agsEnabled: process.env.LTI_AGS_ENABLED === 'true',
  };
}

async function resolvePlatformConfig(tenantId) {
  const env = envPlatformDefaults();
  let doc = null;
  if (tenantId) {
    doc = await LtiPlatformConfig.findOne(withTenantFilter({ isActive: true }, tenantId)).lean();
  }
  const merged = {
    ...env,
    ...(doc || {}),
    issuer: doc?.issuer || env.issuer,
    clientId: doc?.clientId || env.clientId,
    clientSecret: doc?.clientSecret || env.clientSecret,
    deploymentId: doc?.deploymentId || env.deploymentId,
    jwksUrl: doc?.jwksUrl || env.jwksUrl,
    tokenUrl: doc?.tokenUrl || env.tokenUrl,
    lineItemsUrl: doc?.lineItemsUrl || env.lineItemsUrl,
    scopes: doc?.scopes?.length ? doc.scopes : env.scopes,
    agsEnabled: doc ? Boolean(doc.agsEnabled) : env.agsEnabled,
  };
  return merged;
}

function platformReady(cfg) {
  const missing = [];
  if (!cfg.issuer) missing.push('issuer');
  if (!cfg.clientId) missing.push('clientId');
  if (!cfg.tokenUrl) missing.push('tokenUrl');
  if (!cfg.lineItemsUrl) missing.push('lineItemsUrl');
  if (!cfg.clientSecret && !process.env.LTI_CLIENT_SECRET) missing.push('clientSecret');
  return { ready: missing.length === 0 && isAgsEnabled(cfg), missing };
}

async function fetchAccessToken(cfg) {
  const key = `${cfg.tokenUrl}|${cfg.clientId}`;
  if (cachedToken.accessToken && cachedToken.key === key && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret || process.env.LTI_CLIENT_SECRET || '',
    scope: (cfg.scopes || AGS_SCOPES).join(' '),
  });

  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: text };
  }
  if (!res.ok || !json.access_token) {
    const err = new Error(`LTI token failed (${res.status}): ${json.error || text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  cachedToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
    key,
  };
  return json.access_token;
}

async function agsFetch(url, { method = 'GET', token, body, contentType } = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.ims.lis.v2.lineitem+json, application/json',
  };
  if (body != null) {
    headers['Content-Type'] =
      contentType || 'application/vnd.ims.lis.v2.lineitem+json';
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, body: json, text };
}

function resolveLineItemsUrl(cfg, { contextId } = {}) {
  let url = String(cfg.lineItemsUrl || '');
  if (contextId) url = url.replace('{contextId}', String(contextId));
  return url;
}

/**
 * Ensure a line item exists for the course (create via AGS if missing).
 */
async function ensureLineItem({
  tenantId,
  accountId,
  courseId,
  sectionId,
  label = 'Final grade',
  scoreMaximum = 100,
  resourceLinkId = '',
  tag = 'final',
  dryRun = false,
}) {
  const cfg = await resolvePlatformConfig(tenantId);
  const existing = await LtiLineItem.findOne(
    withTenantFilter({ courseId: courseId || null, tag }, tenantId)
  ).lean();
  if (existing?.lineItemUrl) {
    return { lineItem: existing, created: false, dryRun };
  }

  if (dryRun || !isAgsEnabled(cfg)) {
    return {
      lineItem: null,
      created: false,
      dryRun: true,
      message: 'Line item create skipped (dry-run or AGS disabled)',
    };
  }

  const ready = platformReady(cfg);
  if (!ready.ready) {
    const err = new Error(`LTI AGS not ready: missing ${ready.missing.join(', ')}`);
    err.status = 400;
    err.code = 'LTI_AGS_NOT_READY';
    throw err;
  }

  const token = await fetchAccessToken(cfg);
  const container = resolveLineItemsUrl(cfg, { contextId: courseId });
  const payload = {
    scoreMaximum: Number(scoreMaximum) || 100,
    label,
    tag,
    resourceId: resourceLinkId || String(courseId || ''),
    resourceLinkId: resourceLinkId || undefined,
  };

  const created = await agsFetch(container, {
    method: 'POST',
    token,
    body: payload,
    contentType: 'application/vnd.ims.lis.v2.lineitem+json',
  });

  if (!created.ok) {
    const err = new Error(
      `Line item create failed (${created.status}): ${typeof created.text === 'string' ? created.text.slice(0, 200) : 'error'}`
    );
    err.status = created.status;
    throw err;
  }

  const lineItemUrl =
    created.body?.id ||
    created.body?.lineItemUrl ||
    (typeof created.body === 'object' && created.body?.url) ||
    `${container.replace(/\/$/, '')}/${crypto.randomBytes(4).toString('hex')}`;

  const doc = await LtiLineItem.create({
    courseId: courseId || null,
    sectionId: sectionId || null,
    resourceLinkId: resourceLinkId || '',
    label,
    scoreMaximum: Number(scoreMaximum) || 100,
    lineItemId: String(created.body?.id || ''),
    lineItemUrl: String(lineItemUrl),
    tag,
    lastSyncedAt: new Date(),
    rootAccountId: tenantId,
    accountId: accountId || tenantId,
    meta: { response: created.body },
  });

  return { lineItem: doc.toObject(), created: true, dryRun: false };
}

async function resolveLtiUserId(tenantId, row) {
  const explicit = row.lti_user_id || row.ltiUserId || row.userId || row.sub;
  if (explicit) return String(explicit);

  const email = row.email ? String(row.email).toLowerCase().trim() : '';
  const sisId = row.sis_student_id || row.sisStudentId || '';
  let user = null;
  if (sisId) {
    user = await User.findOne(
      withTenantFilter({ 'studentProfile.externalIds.sis': String(sisId).trim() }, tenantId)
    )
      .select('ltiUserId studentProfile email')
      .lean();
  }
  if (!user && email) {
    user = await User.findOne(withTenantFilter({ email }, tenantId))
      .select('ltiUserId studentProfile email')
      .lean();
  }
  return (
    user?.ltiUserId ||
    user?.studentProfile?.externalIds?.lti ||
    user?.studentProfile?.externalIds?.sis ||
    (email ? email : null)
  );
}

/**
 * POST scores to a line item URL for each row.
 */
async function postScores({ cfg, lineItemUrl, rows, tenantId, dryRun }) {
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      submitted: 0,
      failed: 0,
      results: rows.map((r) => ({ dryRun: true, row: r.email || r.sis_student_id })),
    };
  }

  const token = await fetchAccessToken(cfg);
  const scoreUrl = `${String(lineItemUrl).replace(/\/$/, '')}/scores`;
  const results = [];
  let submitted = 0;
  let failed = 0;

  for (const row of rows) {
    const userId = await resolveLtiUserId(tenantId, row);
    if (!userId) {
      failed += 1;
      results.push({ ok: false, error: 'no_lti_user_id', row });
      continue;
    }
    const scoreGiven =
      row.final_percent != null && row.final_percent !== ''
        ? Number(row.final_percent)
        : row.scoreGiven != null
          ? Number(row.scoreGiven)
          : null;
    const scoreMaximum = row.scoreMaximum != null ? Number(row.scoreMaximum) : 100;
    const body = {
      userId: String(userId),
      scoreGiven: scoreGiven != null && !Number.isNaN(scoreGiven) ? scoreGiven : undefined,
      scoreMaximum,
      comment: row.final_grade || row.letter_grade || '',
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      timestamp: new Date().toISOString(),
    };

    const res = await agsFetch(scoreUrl, {
      method: 'POST',
      token,
      body,
      contentType: 'application/vnd.ims.lis.v1.score+json',
    });
    if (res.ok) {
      submitted += 1;
      results.push({ ok: true, userId, status: res.status });
    } else {
      failed += 1;
      results.push({
        ok: false,
        userId,
        status: res.status,
        error: typeof res.text === 'string' ? res.text.slice(0, 200) : 'score_failed',
      });
    }
  }

  return { ok: failed === 0, dryRun: false, submitted, failed, results };
}

/**
 * Submit grade rows via AGS (replaces submitScoresStub).
 */
async function submitScores({
  tenantId,
  accountId,
  term,
  year,
  rows = [],
  exportedBy,
  dryRun = false,
  courseId = null,
  lineItemUrl = null,
  label = 'Final grade',
}) {
  const cfg = await resolvePlatformConfig(tenantId);
  const enabled = isAgsEnabled(cfg);
  const ready = platformReady(cfg);
  const forceDry = dryRun || !enabled || !ready.ready;

  let lineItemResult = null;
  let scoreResult = null;
  let errorMessage = '';

  try {
    if (!forceDry) {
      if (lineItemUrl) {
        lineItemResult = { lineItem: { lineItemUrl }, created: false };
      } else if (courseId || rows[0]?.course_id) {
        lineItemResult = await ensureLineItem({
          tenantId,
          accountId,
          courseId: courseId || rows[0]?.course_id,
          label,
          dryRun: false,
        });
      } else if (cfg.lineItemsUrl && !cfg.lineItemsUrl.includes('{')) {
        // Use container as line item when partner provides a single-item URL
        lineItemResult = { lineItem: { lineItemUrl: cfg.lineItemsUrl }, created: false };
      } else {
        errorMessage = 'No courseId/lineItemUrl for AGS line item';
      }

      const url = lineItemResult?.lineItem?.lineItemUrl;
      if (url) {
        scoreResult = await postScores({
          cfg,
          lineItemUrl: url,
          rows,
          tenantId,
          dryRun: false,
        });
        if (!scoreResult.ok) {
          errorMessage = `AGS score failures: ${scoreResult.failed}`;
        }
      }
    } else if (!enabled) {
      errorMessage = 'ags_not_enabled';
    } else if (!ready.ready) {
      errorMessage = `ags_not_ready:${ready.missing.join(',')}`;
    }
  } catch (err) {
    errorMessage = err.message;
    scoreResult = { ok: false, error: err.message };
  }

  const status = forceDry
    ? 'preview'
    : scoreResult?.ok
      ? 'sent'
      : errorMessage
        ? 'failed'
        : 'exported';

  const record = await GradePassbackRecord.create({
    term: term || 'unknown',
    year: Number(year) || new Date().getFullYear(),
    provider: 'lti',
    channel: 'lti_ags',
    status,
    rowCount: rows.length,
    rows: rows.slice(0, 100),
    csvText: '',
    exportedBy: exportedBy || null,
    notes: forceDry
      ? `LTI AGS preview (${errorMessage || 'dry-run'})`
      : `LTI AGS submit submitted=${scoreResult?.submitted || 0} failed=${scoreResult?.failed || 0}`,
    rootAccountId: tenantId,
    accountId: accountId || tenantId,
    errorMessage: errorMessage || '',
  });

  return {
    ok: !errorMessage || status === 'preview',
    stub: false,
    agsEnabled: enabled,
    dryRun: forceDry,
    platformReady: ready.ready,
    missing: ready.missing,
    config: {
      issuer: cfg.issuer,
      clientId: cfg.clientId,
      deploymentId: cfg.deploymentId,
      tokenUrl: cfg.tokenUrl ? '[set]' : '',
      lineItemsUrl: cfg.lineItemsUrl ? '[set]' : '',
    },
    lineItem: lineItemResult?.lineItem
      ? { url: lineItemResult.lineItem.lineItemUrl, created: lineItemResult.created }
      : null,
    scores: scoreResult
      ? {
          submitted: scoreResult.submitted,
          failed: scoreResult.failed,
          dryRun: scoreResult.dryRun,
        }
      : null,
    recordId: record._id,
    status: record.status,
    rowCount: rows.length,
    errorMessage: errorMessage || undefined,
  };
}

/** @deprecated Use submitScores — kept for callers/tests during transition */
async function submitScoresStub(opts) {
  return submitScores({ ...opts, dryRun: opts.dryRun !== false });
}

function getAgsReadiness(tenantId) {
  // Sync shape for GET without DB — env only; async variant below for Office status
  const cfg = { ...getLtiConfig(), ...envPlatformDefaults(), agsEnabled: isAgsEnabled() };
  const ready = platformReady(cfg);
  return {
    ...cfg,
    clientSecret: cfg.clientSecret ? '[set]' : '',
    agsEnabled: isAgsEnabled(cfg),
    platformReady: ready.ready,
    missing: ready.missing,
    note: ready.ready
      ? 'LTI AGS configured — line-item sync and score POST enabled when LTI_AGS_ENABLED=true.'
      : isAgsEnabled(cfg)
        ? `AGS enabled but incomplete config: missing ${ready.missing.join(', ') || 'fields'}.`
        : 'Set LTI_AGS_ENABLED=true and token/line-items URLs to enable grade passback.',
  };
}

async function getAgsReadinessAsync(tenantId) {
  const cfg = await resolvePlatformConfig(tenantId);
  const ready = platformReady(cfg);
  const base = getAgsReadiness(tenantId);
  return {
    ...base,
    issuer: cfg.issuer || null,
    clientId: cfg.clientId || null,
    deploymentId: cfg.deploymentId || null,
    jwksUrl: cfg.jwksUrl || null,
    tokenUrl: cfg.tokenUrl ? '[set]' : null,
    lineItemsUrl: cfg.lineItemsUrl ? '[set]' : null,
    agsEnabled: isAgsEnabled(cfg),
    platformReady: ready.ready,
    missing: ready.missing,
    note: ready.ready
      ? 'LTI AGS ready for line-item sync and score passback.'
      : base.note,
  };
}

function clearTokenCache() {
  cachedToken = { accessToken: null, expiresAt: 0, key: '' };
}

module.exports = {
  isAgsEnabled,
  submitScores,
  submitScoresStub,
  ensureLineItem,
  getAgsReadiness,
  getAgsReadinessAsync,
  resolvePlatformConfig,
  platformReady,
  fetchAccessToken,
  validateLaunchPayload,
  getLtiConfig,
  clearTokenCache,
  AGS_SCOPES,
};
