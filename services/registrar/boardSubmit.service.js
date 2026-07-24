/**
 * India board / portal submit — export-only default, optional certified partner webhook.
 */
const crypto = require('crypto');
const BoardSubmissionLog = require('../../models/boardSubmissionLog.model');
const indiaReports = require('../registrar/indiaReports.service');

function getBoardMode() {
  const mode = String(process.env.BOARD_SUBMIT_MODE || 'export_only').toLowerCase();
  if (mode === 'partner_webhook' || mode === 'partner') return 'partner_webhook';
  return 'export_only';
}

function getPartnerConfig() {
  return {
    url: String(process.env.BOARD_PARTNER_WEBHOOK_URL || '').trim(),
    secret: String(process.env.BOARD_PARTNER_WEBHOOK_SECRET || '').trim(),
  };
}

function getBoardHealth() {
  const mode = getBoardMode();
  const partner = getPartnerConfig();
  return {
    mode,
    partnerConfigured: Boolean(partner.url),
    canSubmit: mode === 'partner_webhook' && Boolean(partner.url),
    note:
      mode === 'partner_webhook' && partner.url
        ? 'Partner webhook submit enabled for India report kinds.'
        : 'Export-only — download CSV extracts; set BOARD_SUBMIT_MODE=partner_webhook + BOARD_PARTNER_WEBHOOK_URL for submit.',
  };
}

async function postPartnerWebhook({ kind, payload, dryRun }) {
  const { url, secret } = getPartnerConfig();
  if (!url) {
    return { ok: false, message: 'BOARD_PARTNER_WEBHOOK_URL not set' };
  }
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      url,
      payloadPreview: { kind, rowCount: payload?.rowCount, label: payload?.label },
    };
  }

  const body = JSON.stringify({
    kind,
    submittedAt: new Date().toISOString(),
    ...payload,
  });
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (secret) {
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    headers['X-Board-Signature'] = `sha256=${sig}`;
  }

  const res = await fetch(url, { method: 'POST', headers, body });
  const text = await res.text().catch(() => '');
  return {
    ok: res.ok,
    dryRun: false,
    status: res.status,
    body: text.slice(0, 2000),
  };
}

/**
 * Build extract then optionally submit to partner webhook.
 */
async function submitIndiaReport({
  tenantId,
  kind,
  params = {},
  submittedBy = null,
  dryRun = false,
}) {
  const report = await indiaReports.runIndiaReport(kind, tenantId, params);
  const mode = getBoardMode();
  const health = getBoardHealth();

  if (mode === 'export_only' || !health.canSubmit) {
    const log = await BoardSubmissionLog.create({
      kind,
      mode: 'export_only',
      status: 'skipped',
      rowCount: report.rows?.length || 0,
      params,
      submittedBy,
      errorMessage: 'export_only — use CSV download; partner webhook not configured',
      rootAccountId: tenantId,
      accountId: tenantId,
    });
    return {
      ok: true,
      submitted: false,
      mode: 'export_only',
      report: { label: report.label, rowCount: report.rows?.length || 0, kind },
      csvText: report.csvText,
      logId: log._id,
      message: health.note,
    };
  }

  const push = await postPartnerWebhook({
    kind,
    dryRun,
    payload: {
      label: report.label,
      rowCount: report.rows?.length || 0,
      rows: report.rows,
      csvText: report.csvText,
      params,
      tenantId: String(tenantId),
    },
  });

  const log = await BoardSubmissionLog.create({
    kind,
    mode: dryRun ? 'dry_run' : 'partner_webhook',
    status: dryRun ? 'preview' : push.ok ? 'submitted' : 'failed',
    rowCount: report.rows?.length || 0,
    httpStatus: push.status || null,
    responseBody: push.body || '',
    errorMessage: push.ok ? '' : push.message || `HTTP ${push.status}`,
    params,
    submittedBy,
    rootAccountId: tenantId,
    accountId: tenantId,
  });

  return {
    ok: push.ok,
    submitted: !dryRun && push.ok,
    mode: dryRun ? 'dry_run' : 'partner_webhook',
    report: { label: report.label, rowCount: report.rows?.length || 0, kind },
    push,
    logId: log._id,
  };
}

module.exports = {
  getBoardMode,
  getBoardHealth,
  submitIndiaReport,
  postPartnerWebhook,
};
