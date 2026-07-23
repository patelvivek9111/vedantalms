/**
 * LTI 1.3 Assignment and Grade Services (AGS) scaffold.
 * Does not implement full OIDC/JWKS partner protocol — honest stub for post-finalize wiring.
 */
const GradePassbackRecord = require('../../models/gradePassbackRecord.model');
const { getLtiConfig, validateLaunchPayload } = require('./ltiReadiness.service');

function isAgsEnabled() {
  return process.env.LTI_AGS_ENABLED === 'true';
}

/**
 * After finalize / grade export, optionally record an AGS stub passback.
 */
async function submitScoresStub({
  tenantId,
  accountId,
  term,
  year,
  rows = [],
  exportedBy,
  dryRun = true,
}) {
  const cfg = getLtiConfig();
  const enabled = isAgsEnabled();
  const record = await GradePassbackRecord.create({
    term: term || 'unknown',
    year: Number(year) || new Date().getFullYear(),
    provider: 'lti',
    channel: 'lti_ags',
    status: dryRun || !enabled ? 'preview' : 'sent',
    rowCount: rows.length,
    rows: rows.slice(0, 100),
    csvText: '',
    exportedBy: exportedBy || null,
    notes: enabled
      ? 'LTI AGS stub submit (enable full line-item sync in partner adapter)'
      : 'LTI AGS disabled — preview record only. Set LTI_AGS_ENABLED=true to mark sent.',
    rootAccountId: tenantId,
    accountId: accountId || tenantId,
    errorMessage: enabled ? '' : 'ags_not_enabled',
  });

  return {
    ok: true,
    stub: true,
    agsEnabled: enabled,
    config: {
      issuer: cfg.issuer,
      clientId: cfg.clientId,
      deploymentId: cfg.deploymentId,
    },
    recordId: record._id,
    status: record.status,
    rowCount: rows.length,
  };
}

function getAgsReadiness() {
  const cfg = getLtiConfig();
  return {
    ...cfg,
    agsEnabled: isAgsEnabled(),
    note: isAgsEnabled()
      ? 'AGS stub enabled — scores recorded as GradePassbackRecord channel=lti_ags; partner line-item sync not implemented.'
      : cfg.note,
  };
}

module.exports = {
  isAgsEnabled,
  submitScoresStub,
  getAgsReadiness,
  validateLaunchPayload,
  getLtiConfig,
};
