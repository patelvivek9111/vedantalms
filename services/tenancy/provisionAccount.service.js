const Account = require('../../models/account.model');
const AccountDomain = require('../../models/accountDomain.model');
const AccountBrand = require('../../models/accountBrand.model');
const SystemSettings = require('../../models/systemSettings.model');
const InstitutionGradingPolicy = require('../../models/institutionGradingPolicy.model');
const AuthenticationProvider = require('../../models/authenticationProvider.model');
const User = require('../../models/user.model');
const ContactLead = require('../../models/contactLead.model');
const { ensureAccountMembership } = require('./accountMembership.service');
const { clearTenantCache } = require('../../middleware/tenant');
const { DEFAULT_GRADING_POLICY } = require('../../shared/grading/policyDefaults.cjs');

function slugCodeFromOrg(organization) {
  const base = String(organization || 'ORG')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 12);
  const suffix = Date.now().toString(36).toUpperCase().slice(-4);
  return `${base || 'ORG'}${suffix}`.slice(0, 16);
}

/**
 * Provision a root Account (Canvas institution) with brand, settings, password auth, admin.
 */
async function provisionRootAccount({
  name,
  code,
  host,
  institutionMode = 'mixed',
  timezone = 'UTC',
  adminEmail,
  adminPassword,
  adminFirstName = 'Institution',
  adminLastName = 'Admin',
  planCode = 'standard',
}) {
  if (!name || !code) {
    const err = new Error('name and code are required');
    err.status = 400;
    throw err;
  }

  const normalizedCode = String(code).trim().toUpperCase();
  const existing = await Account.findOne({
    code: normalizedCode,
    parentAccountId: null,
    workflowState: { $ne: 'deleted' },
  });
  if (existing) {
    const err = new Error('Account code already exists');
    err.status = 409;
    throw err;
  }

  const account = await Account.create({
    name: String(name).trim(),
    code: normalizedCode,
    parentAccountId: null,
    institutionMode,
    timezone,
    planCode: planCode || 'standard',
  });

  if (host) {
    const normalizedHost = AccountDomain.normalizeHost(host);
    if (normalizedHost) {
      const taken = await AccountDomain.findOne({ host: normalizedHost });
      if (taken) {
        const err = new Error(`Host ${normalizedHost} is already assigned`);
        err.status = 409;
        throw err;
      }
      await AccountDomain.create({
        rootAccountId: account._id,
        host: normalizedHost,
        isPrimary: true,
        isCustomDomain: !['localhost', '127.0.0.1'].includes(normalizedHost),
        verifiedAt: new Date(),
      });
    }
  }

  await AccountBrand.getForRoot(account._id);
  await SystemSettings.create({ rootAccountId: account._id });
  await InstitutionGradingPolicy.create({
    key: `account:${account._id}`,
    rootAccountId: account._id,
    accountId: account._id,
    policy: { ...DEFAULT_GRADING_POLICY },
  });
  await AuthenticationProvider.ensurePasswordProvider(account._id);
  clearTenantCache();

  const { ensureQuota } = require('./accountQuota.service');
  const quota = await ensureQuota(account._id, { planCode: planCode || 'standard' });
  if (planCode) {
    account.planCode = planCode;
    await account.save();
  }

  let adminUser = null;
  if (adminEmail && adminPassword) {
    adminUser = await User.create({
      firstName: adminFirstName,
      lastName: adminLastName,
      email: String(adminEmail).toLowerCase().trim(),
      password: adminPassword,
      role: 'admin',
      rootAccountId: account._id,
      accountId: account._id,
      privacyConsentAt: new Date(),
    });
    await ensureAccountMembership({
      user: adminUser,
      rootAccountId: account._id,
      accountId: account._id,
      role: 'admin',
    });
  }

  return { account, adminUser, quota };
}

async function provisionFromContactLead(
  leadId,
  { host, code, adminPassword, provisionedBy, planCode } = {}
) {
  const lead = await ContactLead.findById(leadId);
  if (!lead) {
    const err = new Error('Lead not found');
    err.status = 404;
    throw err;
  }
  if (lead.status === 'provisioned' && lead.provisionedRootAccountId) {
    return {
      account: await Account.findById(lead.provisionedRootAccountId),
      adminUser: null,
      lead,
      alreadyProvisioned: true,
    };
  }

  const accountCode = code || slugCodeFromOrg(lead.organization);
  const tempPassword =
    adminPassword ||
    `Welcome-${Math.random().toString(36).slice(-8)}A1!`;

  const result = await provisionRootAccount({
    name: lead.organization,
    code: accountCode,
    host,
    adminEmail: lead.email,
    adminPassword: tempPassword,
    adminFirstName: lead.name.split(/\s+/)[0] || 'Admin',
    adminLastName: lead.name.split(/\s+/).slice(1).join(' ') || 'User',
    planCode: planCode || 'starter',
  });

  lead.status = 'provisioned';
  lead.provisionedRootAccountId = result.account._id;
  lead.provisionedAt = new Date();
  lead.provisionedBy = provisionedBy || null;
  await lead.save();

  return {
    ...result,
    lead,
    temporaryPassword: adminPassword ? undefined : tempPassword,
    alreadyProvisioned: false,
  };
}

module.exports = {
  provisionRootAccount,
  provisionFromContactLead,
  slugCodeFromOrg,
};
