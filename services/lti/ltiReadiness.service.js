/**
 * LTI 1.3 readiness — env + optional tenant platform config.
 */
function getLtiConfig() {
  const agsEnabled = process.env.LTI_AGS_ENABLED === 'true';
  return {
    issuer: process.env.LTI_ISSUER || null,
    clientId: process.env.LTI_CLIENT_ID || null,
    deploymentId: process.env.LTI_DEPLOYMENT_ID || null,
    jwksUrl: process.env.LTI_JWKS_URL || null,
    tokenUrl: process.env.LTI_AGS_TOKEN_URL || process.env.LTI_TOKEN_URL || null,
    lineItemsUrl: process.env.LTI_AGS_LINEITEMS_URL || null,
    deepLinkEnabled: process.env.LTI_DEEP_LINK_ENABLED === 'true',
    agsEnabled,
    note: agsEnabled
      ? 'AGS flag on — ensure token URL and line-items URL are set for live passback.'
      : 'Set LTI_AGS_ENABLED=true to enable Assignment and Grade Services passback.',
  };
}

function validateLaunchPayload(payload = {}) {
  const missing = [];
  if (!payload.iss) missing.push('iss');
  if (!payload.aud) missing.push('aud');
  if (!payload.sub) missing.push('sub');
  return { valid: missing.length === 0, missing };
}

module.exports = {
  getLtiConfig,
  validateLaunchPayload,
};
