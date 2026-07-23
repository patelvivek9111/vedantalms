const { Issuer, generators } = require('openid-client');
const crypto = require('crypto');
const AuthenticationProvider = require('../../models/authenticationProvider.model');
const User = require('../../models/user.model');
const Pseudonym = require('../../models/pseudonym.model');
const { ensureAccountMembership } = require('./accountMembership.service');
const { withTenantFilter } = require('../../utils/tenantContext');

const stateStore = new Map(); // state -> { providerId, rootAccountId, codeVerifier, nonce, exp }

function pruneState() {
  const now = Date.now();
  for (const [k, v] of stateStore) {
    if (v.exp < now) stateStore.delete(k);
  }
}

async function loadOidcProvider(providerId, rootAccountId) {
  const provider = await AuthenticationProvider.findOne(
    withTenantFilter(
      {
        _id: providerId,
        authType: { $in: ['oidc', 'google', 'microsoft'] },
        workflowState: 'active',
      },
      rootAccountId
    )
  );
  if (!provider) {
    const err = new Error('OIDC provider not found');
    err.status = 404;
    throw err;
  }
  return provider;
}

function resolveIssuerUrl(provider) {
  const s = provider.settings || {};
  if (s.issuerUrl) return s.issuerUrl;
  if (provider.authType === 'google') return 'https://accounts.google.com';
  if (provider.authType === 'microsoft') {
    const tenant = s.tenantId || 'common';
    return `https://login.microsoftonline.com/${tenant}/v2.0`;
  }
  const err = new Error('issuerUrl is required in provider settings');
  err.status = 400;
  throw err;
}

async function getClient(provider, redirectUri) {
  const s = provider.settings || {};
  const issuerUrl = resolveIssuerUrl(provider);
  const issuer = await Issuer.discover(issuerUrl);
  return new issuer.Client({
    client_id: s.clientId,
    client_secret: s.clientSecret,
    redirect_uris: [redirectUri],
    response_types: ['code'],
  });
}

async function beginOidcLogin({ providerId, rootAccountId, redirectUri, returnTo }) {
  pruneState();
  const provider = await loadOidcProvider(providerId, rootAccountId);
  const client = await getClient(provider, redirectUri);
  const state = generators.state();
  const nonce = generators.nonce();
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);

  stateStore.set(state, {
    providerId: String(provider._id),
    rootAccountId: String(rootAccountId),
    codeVerifier,
    nonce,
    returnTo: returnTo || '/',
    exp: Date.now() + 10 * 60 * 1000,
  });

  const authorizationUrl = client.authorizationUrl({
    scope: (provider.settings && provider.settings.scope) || 'openid email profile',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return { authorizationUrl, state };
}

async function completeOidcLogin({ providerId, rootAccountId, redirectUri, query }) {
  pruneState();
  const stored = stateStore.get(query.state);
  if (!stored || stored.providerId !== String(providerId)) {
    const err = new Error('Invalid or expired OIDC state');
    err.status = 400;
    throw err;
  }
  stateStore.delete(query.state);

  const provider = await loadOidcProvider(providerId, rootAccountId || stored.rootAccountId);
  const client = await getClient(provider, redirectUri);
  const params = client.callbackParams({ method: 'GET', url: `?${new URLSearchParams(query)}` });
  const tokenSet = await client.callback(redirectUri, params, {
    state: query.state,
    nonce: stored.nonce,
    code_verifier: stored.codeVerifier,
  });

  const claims = tokenSet.claims();
  const externalId = String(claims.sub);
  const email = String(claims.email || claims.preferred_username || '').toLowerCase().trim();
  if (!email) {
    const err = new Error('OIDC provider did not return an email claim');
    err.status = 400;
    throw err;
  }

  const tenantId = provider.rootAccountId;
  let pseudonym = await Pseudonym.findOne({
    rootAccountId: tenantId,
    authenticationProviderId: provider._id,
    externalId,
  });

  let user;
  if (pseudonym) {
    user = await User.findById(pseudonym.userId);
  } else {
    user = await User.findOne(withTenantFilter({ email }, tenantId));
    if (!user && provider.jitProvisioning) {
      const nameParts = String(claims.name || email.split('@')[0]).split(/\s+/);
      user = await User.create({
        firstName: nameParts[0] || 'User',
        lastName: nameParts.slice(1).join(' ') || 'SSO',
        email,
        password: crypto.randomBytes(24).toString('hex') + 'Aa1!',
        role: 'student',
        rootAccountId: tenantId,
        accountId: tenantId,
        privacyConsentAt: new Date(),
      });
      await ensureAccountMembership({
        user,
        rootAccountId: tenantId,
        role: 'student',
      });
    }
    if (!user) {
      const err = new Error('No local account for this SSO identity. Contact your admin.');
      err.status = 403;
      throw err;
    }
    pseudonym = await Pseudonym.create({
      userId: user._id,
      rootAccountId: tenantId,
      uniqueId: email,
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

  await ensureAccountMembership({
    user,
    rootAccountId: tenantId,
    role: user.role,
  });

  return {
    user,
    token: user.getSignedJwtToken(),
    returnTo: stored.returnTo || '/',
  };
}

module.exports = {
  beginOidcLogin,
  completeOidcLogin,
  loadOidcProvider,
};
