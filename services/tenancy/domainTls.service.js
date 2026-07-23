const crypto = require('crypto');
const dns = require('dns').promises;
const acme = require('acme-client');
const AccountDomain = require('../../models/accountDomain.model');
const fs = require('fs');
const path = require('path');
const { paths } = require('../../config/paths');

/**
 * Custom domain verification + real ACME (Let's Encrypt) certificate automation.
 */

const challengeStore = new Map(); // token -> keyAuthorization

function buildVerificationToken() {
  return `mysl8te-verify-${crypto.randomBytes(12).toString('hex')}`;
}

function certDirForHost(host) {
  const base = path.join(paths.uploads || path.join(process.cwd(), 'uploads'), 'tls-certs');
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  return path.join(base, host.replace(/[^a-z0-9.-]/gi, '_'));
}

async function addDomain(rootAccountId, host, { isPrimary = false, isCustomDomain = true } = {}) {
  const normalized = AccountDomain.normalizeHost(host);
  if (!normalized) {
    const err = new Error('Invalid host');
    err.status = 400;
    throw err;
  }
  const taken = await AccountDomain.findOne({ host: normalized });
  if (taken) {
    const err = new Error(`Host ${normalized} is already assigned`);
    err.status = 409;
    throw err;
  }

  if (isPrimary) {
    await AccountDomain.updateMany({ rootAccountId }, { $set: { isPrimary: false } });
  }

  return AccountDomain.create({
    rootAccountId,
    host: normalized,
    isPrimary,
    isCustomDomain,
    verifiedAt: null,
    verificationToken: buildVerificationToken(),
    tlsStatus: 'none',
  });
}

async function requestVerification(domainId, rootAccountId) {
  const domain = await AccountDomain.findOne({ _id: domainId, rootAccountId });
  if (!domain) {
    const err = new Error('Domain not found');
    err.status = 404;
    throw err;
  }
  if (!domain.verificationToken) {
    domain.verificationToken = buildVerificationToken();
  }
  domain.tlsStatus = domain.tlsStatus === 'active' ? 'active' : 'pending';
  await domain.save();
  return {
    domain,
    instructions: {
      type: 'TXT',
      name: `_mysl8te-challenge.${domain.host}`,
      value: domain.verificationToken,
    },
  };
}

async function lookupTxtChallenge(host, expected) {
  const name = `_mysl8te-challenge.${host}`;
  try {
    const records = await dns.resolveTxt(name);
    const flat = records.map((r) => r.join(''));
    return flat.some((v) => v === expected);
  } catch {
    return false;
  }
}

async function markVerified(domainId, rootAccountId, { force = false } = {}) {
  const domain = await AccountDomain.findOne({ _id: domainId, rootAccountId });
  if (!domain) {
    const err = new Error('Domain not found');
    err.status = 404;
    throw err;
  }

  const allowForce =
    force &&
    (process.env.NODE_ENV !== 'production' || process.env.DOMAIN_VERIFY_FORCE === 'true');

  if (!allowForce) {
    if (!domain.verificationToken) {
      const err = new Error('Request verification first');
      err.status = 400;
      throw err;
    }
    const ok = await lookupTxtChallenge(domain.host, domain.verificationToken);
    if (!ok) {
      const err = new Error(
        `DNS TXT record not found for _mysl8te-challenge.${domain.host}. Publish the token then retry.`
      );
      err.status = 400;
      throw err;
    }
  }

  domain.verifiedAt = new Date();
  domain.tlsStatus = 'pending';
  await domain.save();
  await enqueueTlsProvision(domain);
  return domain;
}

async function createAcmeClient() {
  const directoryUrl =
    process.env.ACME_DIRECTORY_URL ||
    (process.env.ACME_STAGING === 'true'
      ? acme.directory.letsencrypt.staging
      : acme.directory.letsencrypt.production);

  let accountKey;
  const keyPath = process.env.ACME_ACCOUNT_KEY_PATH;
  if (keyPath && fs.existsSync(keyPath)) {
    accountKey = fs.readFileSync(keyPath);
  } else {
    accountKey = await acme.crypto.createPrivateKey();
    if (keyPath) {
      fs.mkdirSync(path.dirname(keyPath), { recursive: true });
      fs.writeFileSync(keyPath, accountKey);
    }
  }

  return new acme.Client({
    directoryUrl,
    accountKey,
  });
}

/**
 * HTTP-01 challenge responder for Express.
 */
function getHttp01Authorization(token) {
  return challengeStore.get(token) || null;
}

async function provisionWithAcme(domain) {
  const client = await createAcmeClient();
  const email = process.env.ACME_EMAIL || domain.registrarContactEmail || 'ops@mysl8te.local';

  try {
    await client.createAccount({
      termsOfServiceAgreed: true,
      contact: [`mailto:${email}`],
    });
  } catch {
    // account may already exist
  }

  const [key, csr] = await acme.crypto.createCsr({
    commonName: domain.host,
  });

  const cert = await client.auto({
    csr,
    email,
    termsOfServiceAgreed: true,
    challengeCreateFn: async (authz, challenge, keyAuthorization) => {
      if (challenge.type === 'http-01') {
        challengeStore.set(challenge.token, keyAuthorization);
      }
    },
    challengeRemoveFn: async (authz, challenge) => {
      if (challenge.type === 'http-01') {
        challengeStore.delete(challenge.token);
      }
    },
  });

  const dir = certDirForHost(domain.host);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'privkey.pem'), key);
  fs.writeFileSync(path.join(dir, 'fullchain.pem'), cert);

  domain.tlsStatus = 'active';
  domain.tlsLastError = '';
  domain.certificateExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  domain.certificatePath = dir;
  await domain.save();
  return domain;
}

async function enqueueTlsProvision(domain) {
  const webhook = process.env.TLS_PROVISION_WEBHOOK_URL;
  domain.tlsStatus = 'pending';
  domain.tlsLastError = '';

  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.TLS_PROVISION_WEBHOOK_SECRET || ''}`,
        },
        body: JSON.stringify({
          host: domain.host,
          rootAccountId: String(domain.rootAccountId),
          domainId: String(domain._id),
        }),
      });
      await domain.save();
      return domain;
    } catch (err) {
      domain.tlsStatus = 'failed';
      domain.tlsLastError = err.message;
      await domain.save();
      return domain;
    }
  }

  if (process.env.ACME_ENABLED === 'true') {
    try {
      return await provisionWithAcme(domain);
    } catch (err) {
      domain.tlsStatus = 'failed';
      domain.tlsLastError = err.message;
      await domain.save();
      return domain;
    }
  }

  // Dev without ACME: mark active so custom domains are usable behind local TLS termination
  if (process.env.NODE_ENV !== 'production') {
    domain.tlsStatus = 'active';
    domain.certificateExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    await domain.save();
    return domain;
  }

  domain.tlsStatus = 'pending';
  domain.tlsLastError = 'Set ACME_ENABLED=true or TLS_PROVISION_WEBHOOK_URL to provision certificates';
  await domain.save();
  return domain;
}

async function applyTlsCallback({ domainId, host, status, expiresAt, error, secret }) {
  const expected = process.env.TLS_PROVISION_WEBHOOK_SECRET;
  if (expected && secret !== expected) {
    const err = new Error('Invalid TLS callback secret');
    err.status = 401;
    throw err;
  }
  const domain = await AccountDomain.findOne(domainId ? { _id: domainId } : { host });
  if (!domain) {
    const err = new Error('Domain not found');
    err.status = 404;
    throw err;
  }
  domain.tlsStatus = status || 'active';
  domain.tlsLastError = error || '';
  if (expiresAt) domain.certificateExpiresAt = new Date(expiresAt);
  if (domain.tlsStatus === 'active' && !domain.verifiedAt) domain.verifiedAt = new Date();
  await domain.save();
  return domain;
}

module.exports = {
  addDomain,
  requestVerification,
  markVerified,
  enqueueTlsProvision,
  provisionWithAcme,
  getHttp01Authorization,
  applyTlsCallback,
  buildVerificationToken,
  lookupTxtChallenge,
};
