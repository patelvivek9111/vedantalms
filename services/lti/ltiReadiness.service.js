/**
 * LTI 1.3 readiness scaffold — launch validation hooks without AGS grade sync.
 */
function getLtiConfig() {
  return {
    issuer: process.env.LTI_ISSUER || null,
    clientId: process.env.LTI_CLIENT_ID || null,
    deploymentId: process.env.LTI_DEPLOYMENT_ID || null,
    jwksUrl: process.env.LTI_JWKS_URL || null,
    deepLinkEnabled: process.env.LTI_DEEP_LINK_ENABLED === 'true',
    agsEnabled: false,
    note: 'AGS grade passback not enabled; extend ltiGradeService when ready.',
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
