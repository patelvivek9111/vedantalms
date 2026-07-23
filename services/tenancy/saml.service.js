const crypto = require('crypto');
const AuthenticationProvider = require('../../models/authenticationProvider.model');
const User = require('../../models/user.model');
const Pseudonym = require('../../models/pseudonym.model');
const { ensureAccountMembership } = require('./accountMembership.service');
const { withTenantFilter } = require('../../utils/tenantContext');

/**
 * SAML 2.0 AuthnRequest + Response (lightweight, no passport).
 * settings: { entityId, ssoUrl, certificate, acsUrl? }
 */

function buildAuthnRequestXml({ issuer, destination, assertionConsumerServiceURL, id }) {
  const issueInstant = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${id}"
  Version="2.0"
  IssueInstant="${issueInstant}"
  Destination="${destination}"
  AssertionConsumerServiceURL="${assertionConsumerServiceURL}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${issuer}</saml:Issuer>
</samlp:AuthnRequest>`;
}

function deflateAndBase64(xml) {
  const zlib = require('zlib');
  const deflated = zlib.deflateRawSync(Buffer.from(xml, 'utf8'));
  return deflated.toString('base64');
}

function decodeSamlResponse(b64) {
  const xml = Buffer.from(b64, 'base64').toString('utf8');
  return xml;
}

function extractFromAssertion(xml) {
  const nameId =
    (xml.match(/<saml2?:NameID[^>]*>([^<]+)<\/saml2?:NameID>/i) ||
      xml.match(/<NameID[^>]*>([^<]+)<\/NameID>/i) ||
      [])[1] || '';
  const email =
    (xml.match(/EmailAddress[^>]*>\s*<[^>]+>([^<]+)/i) ||
      xml.match(/mail[^>]*>\s*<[^>]+>([^<]+)/i) ||
      xml.match(/emailaddress[^>]*>([^<]+)/i) ||
      [])[1] ||
    (nameId.includes('@') ? nameId : '');
  return {
    nameId: String(nameId).trim(),
    email: String(email || nameId).toLowerCase().trim(),
  };
}

async function loadSamlProvider(providerId, rootAccountId) {
  const provider = await AuthenticationProvider.findOne(
    withTenantFilter(
      { _id: providerId, authType: 'saml', workflowState: 'active' },
      rootAccountId
    )
  );
  if (!provider) {
    const err = new Error('SAML provider not found');
    err.status = 404;
    throw err;
  }
  const s = provider.settings || {};
  if (!s.ssoUrl || !s.entityId) {
    const err = new Error('SAML settings require entityId and ssoUrl');
    err.status = 400;
    throw err;
  }
  return provider;
}

async function beginSamlLogin({ providerId, rootAccountId, acsUrl }) {
  const provider = await loadSamlProvider(providerId, rootAccountId);
  const s = provider.settings;
  const id = `_${crypto.randomBytes(16).toString('hex')}`;
  const xml = buildAuthnRequestXml({
    issuer: s.spEntityId || s.entityId,
    destination: s.ssoUrl,
    assertionConsumerServiceURL: acsUrl,
    id,
  });
  const SAMLRequest = deflateAndBase64(xml);
  const redirectUrl = `${s.ssoUrl}${s.ssoUrl.includes('?') ? '&' : '?'}SAMLRequest=${encodeURIComponent(SAMLRequest)}`;
  return { redirectUrl, requestId: id };
}

async function completeSamlLogin({ providerId, rootAccountId, SAMLResponse }) {
  if (!SAMLResponse) {
    const err = new Error('SAMLResponse is required');
    err.status = 400;
    throw err;
  }
  const provider = await loadSamlProvider(providerId, rootAccountId);
  const xml = decodeSamlResponse(SAMLResponse);
  // Optional cert presence check (full XML-DSIG verification can be added with xml-crypto)
  if (provider.settings.certificate && !xml.includes('Signature')) {
    // Allow unsigned in non-production for IdP test benches
    if (process.env.NODE_ENV === 'production' && process.env.SAML_ALLOW_UNSIGNED !== 'true') {
      const err = new Error('Unsigned SAML response rejected');
      err.status = 400;
      throw err;
    }
  }

  const { nameId, email } = extractFromAssertion(xml);
  if (!nameId && !email) {
    const err = new Error('Could not parse NameID/email from SAML assertion');
    err.status = 400;
    throw err;
  }

  const tenantId = provider.rootAccountId;
  const externalId = nameId || email;
  let pseudonym = await Pseudonym.findOne({
    rootAccountId: tenantId,
    authenticationProviderId: provider._id,
    externalId,
  });

  let user;
  if (pseudonym) {
    user = await User.findById(pseudonym.userId);
  } else {
    user = email ? await User.findOne(withTenantFilter({ email }, tenantId)) : null;
    if (!user && provider.jitProvisioning) {
      user = await User.create({
        firstName: 'SAML',
        lastName: 'User',
        email: email || `${externalId.replace(/[^a-z0-9]/gi, '')}@sso.local`,
        password: crypto.randomBytes(24).toString('hex') + 'Aa1!',
        role: 'student',
        rootAccountId: tenantId,
        accountId: tenantId,
        privacyConsentAt: new Date(),
      });
      await ensureAccountMembership({ user, rootAccountId: tenantId, role: 'student' });
    }
    if (!user) {
      const err = new Error('No local account for this SAML identity');
      err.status = 403;
      throw err;
    }
    await Pseudonym.create({
      userId: user._id,
      rootAccountId: tenantId,
      uniqueId: (email || externalId).toLowerCase(),
      externalId,
      authenticationProviderId: provider._id,
      workflowState: 'active',
    });
  }

  if (!user || user.accountStatus === 'suspended') {
    const err = new Error('Account unavailable');
    err.status = 403;
    throw err;
  }

  await ensureAccountMembership({ user, rootAccountId: tenantId, role: user.role });
  return { user, token: user.getSignedJwtToken() };
}

module.exports = {
  beginSamlLogin,
  completeSamlLogin,
  loadSamlProvider,
};
