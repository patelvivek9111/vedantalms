const mongoose = require('mongoose');
const Account = require('../../models/account.model');
const AccountDomain = require('../../models/accountDomain.model');
const AccountBrand = require('../../models/accountBrand.model');
const SystemSettings = require('../../models/systemSettings.model');
const InstitutionGradingPolicy = require('../../models/institutionGradingPolicy.model');

const DEFAULT_CODE = (process.env.DEFAULT_ROOT_ACCOUNT_CODE || 'DEFAULT').toUpperCase();
const DEFAULT_NAME = process.env.DEFAULT_ROOT_ACCOUNT_NAME || 'Default Institution';

function hostsFromEnv() {
  const hosts = new Set();
  const add = (raw) => {
    const h = AccountDomain.normalizeHost(raw);
    if (h) hosts.add(h);
  };

  add('localhost');
  add('127.0.0.1');
  add(process.env.DEFAULT_TENANT_HOST);

  for (const key of ['FRONTEND_URL', 'APP_URL', 'PUBLIC_URL', 'RENDER_EXTERNAL_URL']) {
    const val = process.env[key];
    if (!val) continue;
    try {
      add(new URL(val.includes('://') ? val : `https://${val}`).host);
    } catch {
      add(val);
    }
  }

  const extra = process.env.TENANT_EXTRA_HOSTS || '';
  for (const part of extra.split(',')) add(part);
  return [...hosts];
}

/**
 * Ensure a Canvas-style default root Account exists and owns legacy singleton rows.
 * Safe to call on every API boot.
 */
async function ensureDefaultRootAccount() {
  let root = await Account.findOne({
    parentAccountId: null,
    code: DEFAULT_CODE,
    workflowState: { $ne: 'deleted' },
  });

  if (!root) {
    root = await Account.create({
      name: DEFAULT_NAME,
      code: DEFAULT_CODE,
      parentAccountId: null,
      institutionMode: 'mixed',
      timezone: process.env.TZ || 'UTC',
    });
  }

  if (!root.rootAccountId || String(root.rootAccountId) !== String(root._id)) {
    root.rootAccountId = root._id;
    await root.save();
  }

  const hosts = hostsFromEnv();
  let primarySet = Boolean(await AccountDomain.findOne({ rootAccountId: root._id, isPrimary: true }));
  for (const host of hosts) {
    const existing = await AccountDomain.findOne({ host });
    if (existing) {
      if (String(existing.rootAccountId) !== String(root._id)) {
        // Host claimed by another tenant — leave it
        continue;
      }
      continue;
    }
    await AccountDomain.create({
      rootAccountId: root._id,
      host,
      isPrimary: !primarySet,
      isCustomDomain: false,
      verifiedAt: new Date(),
    });
    primarySet = true;
  }

  await AccountBrand.getForRoot(root._id);

  const AuthenticationProvider = require('../../models/authenticationProvider.model');
  await AuthenticationProvider.ensurePasswordProvider(root._id);

  // Claim legacy SystemSettings singleton(s)
  const orphanSettings = await SystemSettings.find({
    $or: [{ rootAccountId: null }, { rootAccountId: { $exists: false } }],
  });
  if (orphanSettings.length) {
    await SystemSettings.updateMany(
      { _id: { $in: orphanSettings.map((s) => s._id) } },
      { $set: { rootAccountId: root._id } }
    );
  } else {
    const has = await SystemSettings.findOne({ rootAccountId: root._id });
    if (!has) {
      await SystemSettings.create({ rootAccountId: root._id });
    }
  }

  // Claim legacy institution grading policy
  const orphanPolicy = await InstitutionGradingPolicy.find({
    $or: [{ rootAccountId: null }, { rootAccountId: { $exists: false } }],
  });
  if (orphanPolicy.length) {
    await InstitutionGradingPolicy.updateMany(
      { _id: { $in: orphanPolicy.map((p) => p._id) } },
      { $set: { rootAccountId: root._id, accountId: root._id } }
    );
  } else {
    const hasPolicy = await InstitutionGradingPolicy.findOne({ rootAccountId: root._id });
    if (!hasPolicy) {
      await InstitutionGradingPolicy.create({
        key: `account:${root._id}`,
        rootAccountId: root._id,
        accountId: root._id,
      });
    }
  }

  // Claim orphan users/courses (single-tenant migration + test bootstrap)
  const User = require('../../models/user.model');
  const Course = require('../../models/course.model');
  const orphanFilter = {
    $or: [{ rootAccountId: null }, { rootAccountId: { $exists: false } }],
  };
  await User.updateMany(orphanFilter, {
    $set: { rootAccountId: root._id, accountId: root._id },
  });
  await Course.updateMany(orphanFilter, {
    $set: { rootAccountId: root._id, accountId: root._id },
  });

  // Phase 2: ensure password provider + backfill memberships for users missing AccountUser
  try {
    const AccountUser = require('../../models/accountUser.model');
    const { ensureAccountMembership } = require('./accountMembership.service');
    const memberIds = await AccountUser.distinct('userId', { rootAccountId: root._id });
    const users = await User.find({
      rootAccountId: root._id,
      _id: { $nin: memberIds },
    }).limit(200);
    for (const u of users) {
      await ensureAccountMembership({
        user: u,
        rootAccountId: root._id,
        accountId: root._id,
        role: u.role,
      });
    }
  } catch (err) {
    console.warn('Membership backfill skipped:', err.message);
  }

  return root;
}

async function getDefaultRootAccountId() {
  const root = await ensureDefaultRootAccount();
  return root._id;
}

module.exports = {
  DEFAULT_CODE,
  DEFAULT_NAME,
  ensureDefaultRootAccount,
  getDefaultRootAccountId,
  hostsFromEnv,
};
