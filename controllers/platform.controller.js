const Account = require('../models/account.model');
const AccountDomain = require('../models/accountDomain.model');
const AccountBrand = require('../models/accountBrand.model');
const AccountFeatureFlag = require('../models/accountFeatureFlag.model');
const AuthenticationProvider = require('../models/authenticationProvider.model');
const ContactLead = require('../models/contactLead.model');
const SystemAuditEvent = require('../models/systemAuditEvent.model');
const { ensureDefaultRootAccount } = require('../services/tenancy/ensureDefaultRootAccount.service');
const { provisionRootAccount, provisionFromContactLead } = require('../services/tenancy/provisionAccount.service');
const {
  getQuota,
  updateQuota,
  recountSeats,
  recountStorage,
  ensureQuota,
} = require('../services/tenancy/accountQuota.service');
const domainTls = require('../services/tenancy/domainTls.service');
const {
  startImpersonation,
  endImpersonation,
} = require('../services/tenancy/impersonation.service');
const { resolveShardForRoot } = require('../config/tenantShardMap');
const { clearTenantCache } = require('../middleware/tenant');
const { isPublicRegistrationDisabled } = require('../services/securityPolicy.service');
const { enqueueJob } = require('../services/jobQueue.service');

function requirePlatformAdmin(req, res, next) {
  if (req.user?.role !== 'platform_admin') {
    return res.status(403).json({
      success: false,
      message: 'Platform admin access required',
    });
  }
  return next();
}

async function loadRootAccount(id) {
  return Account.findOne({ _id: id, parentAccountId: null, workflowState: { $ne: 'deleted' } });
}

/** Public: branding + identity + auth providers for the resolved tenant host. */
exports.getCurrentTenant = async (req, res) => {
  try {
    const account = req.account || (req.rootAccountId ? await Account.findById(req.rootAccountId) : null);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Institution not found' });
    }
    const rootId = account.rootAccountId || account._id;
    const [brand, domains, providers] = await Promise.all([
      AccountBrand.getForRoot(rootId),
      AccountDomain.find({ rootAccountId: rootId })
        .select('host isPrimary isCustomDomain verifiedAt tlsStatus')
        .lean(),
      AuthenticationProvider.find({ rootAccountId: rootId, workflowState: 'active' })
        .select('authType name position jitProvisioning')
        .sort({ position: 1 })
        .lean(),
    ]);

    return res.json({
      success: true,
      data: {
        rootAccountId: rootId,
        name: account.name,
        code: account.code,
        planCode: account.planCode,
        workflowState: account.workflowState,
        institutionMode: account.institutionMode,
        timezone: account.timezone,
        brand,
        domains,
        authProviders: providers,
        publicRegistrationDisabled: isPublicRegistrationDisabled(rootId),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.listAccounts = async (req, res) => {
  try {
    const accounts = await Account.find({ parentAccountId: null, workflowState: { $ne: 'deleted' } })
      .sort({ name: 1 })
      .lean();
    return res.json({ success: true, count: accounts.length, data: accounts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createRootAccount = async (req, res) => {
  try {
    const {
      name,
      code,
      host,
      institutionMode,
      timezone,
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName,
      planCode,
    } = req.body || {};

    const result = await provisionRootAccount({
      name,
      code,
      host,
      institutionMode: institutionMode || 'mixed',
      timezone: timezone || 'UTC',
      adminEmail,
      adminPassword,
      adminFirstName: adminFirstName || 'Institution',
      adminLastName: adminLastName || 'Admin',
      planCode: planCode || 'standard',
    });

    return res.status(201).json({
      success: true,
      data: {
        account: result.account,
        adminUserId: result.adminUser?._id || null,
        quota: result.quota || null,
      },
    });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.updateRootAccount = async (req, res) => {
  try {
    const account = await loadRootAccount(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });

    const { name, timezone, institutionMode, planCode, workflowState, registrarContactEmail } =
      req.body || {};

    if (name != null) account.name = String(name).trim();
    if (timezone != null) account.timezone = timezone;
    if (institutionMode != null) account.institutionMode = institutionMode;
    if (registrarContactEmail != null) account.registrarContactEmail = registrarContactEmail;
    if (planCode != null) {
      account.planCode = planCode;
      await updateQuota(account._id, { planCode });
    }
    if (workflowState != null) {
      if (!['active', 'suspended', 'deleted'].includes(workflowState)) {
        return res.status(400).json({ success: false, message: 'Invalid workflowState' });
      }
      account.workflowState = workflowState;
    }

    await account.save();
    clearTenantCache();
    return res.json({ success: true, data: account });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.getAccountQuota = async (req, res) => {
  try {
    const account = await loadRootAccount(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    const quota = await getQuota(account._id);
    const seatsUsed = await recountSeats(account._id);
    const storageUsedBytes = await recountStorage(account._id);
    return res.json({
      success: true,
      data: {
        ...quota.toObject(),
        seatsUsed,
        storageUsedBytes,
        shard: resolveShardForRoot({ rootAccountId: account._id, accountCode: account.code }),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.putAccountQuota = async (req, res) => {
  try {
    const account = await loadRootAccount(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    const quota = await updateQuota(account._id, req.body || {});
    if (req.body?.planCode) {
      account.planCode = req.body.planCode;
      await account.save();
    }
    return res.json({ success: true, data: quota });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.addAccountDomain = async (req, res) => {
  try {
    const account = await loadRootAccount(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    const { host, isPrimary, isCustomDomain } = req.body || {};
    const domain = await domainTls.addDomain(account._id, host, {
      isPrimary: Boolean(isPrimary),
      isCustomDomain: isCustomDomain !== false,
    });
    clearTenantCache();
    return res.status(201).json({ success: true, data: domain });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.requestDomainVerification = async (req, res) => {
  try {
    const result = await domainTls.requestVerification(req.params.domainId, req.params.id);
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.verifyAccountDomain = async (req, res) => {
  try {
    const domain = await domainTls.markVerified(req.params.domainId, req.params.id, {
      force: req.body?.force !== false,
    });
    clearTenantCache();
    return res.json({ success: true, data: domain });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.tlsCallback = async (req, res) => {
  try {
    const secret =
      req.get('x-tls-callback-secret') ||
      req.body?.secret ||
      (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const domain = await domainTls.applyTlsCallback({
      domainId: req.body?.domainId,
      host: req.body?.host,
      status: req.body?.status,
      expiresAt: req.body?.expiresAt,
      error: req.body?.error,
      secret,
    });
    clearTenantCache();
    return res.json({ success: true, data: domain });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.exportAccount = async (req, res) => {
  try {
    const account = await loadRootAccount(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });

    const { job, async: isAsync } = await enqueueJob(
      'export.institution',
      {
        rootAccountId: account._id,
        sections: req.body?.sections,
        notes: req.body?.notes || `Export for ${account.code}`,
      },
      req.user,
      { rootAccountId: account._id }
    );

    return res.status(isAsync ? 202 : 200).json({
      success: true,
      async: isAsync,
      data: job,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.offboardAccount = async (req, res) => {
  try {
    const account = await loadRootAccount(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });

    const { job } = await enqueueJob(
      'export.institution',
      {
        rootAccountId: account._id,
        sections: ['users', 'courses', 'enrollments', 'systemSettings', 'fileAssets', 'permissionsRoles'],
        notes: `Offboard export for ${account.code}`,
      },
      req.user,
      { rootAccountId: account._id }
    );

    account.workflowState = 'suspended';
    await account.save();
    clearTenantCache();

    return res.json({
      success: true,
      data: {
        account,
        exportJobId: job._id,
        message: 'Institution suspended after export job enqueue',
      },
    });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.startImpersonation = async (req, res) => {
  try {
    const { targetUserId, rootAccountId, reason } = req.body || {};
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'targetUserId is required' });
    }
    const result = await startImpersonation({
      actor: req.user,
      targetUserId,
      rootAccountId: rootAccountId || req.rootAccountId,
      reason,
      ip: req.ip,
      requestId: req.requestId,
    });
    return res.status(201).json({
      success: true,
      data: {
        token: result.token,
        sessionId: result.session._id,
        targetUserId: result.target._id,
        rootAccountId: result.session.rootAccountId,
      },
    });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.endImpersonation = async (req, res) => {
  try {
    const session = await endImpersonation({
      actor: req.user,
      sessionId: req.body?.sessionId,
      ip: req.ip,
      requestId: req.requestId,
    });
    return res.json({ success: true, data: session });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.listImpersonationAudit = async (req, res) => {
  try {
    const filter = { entityType: 'support_impersonation' };
    if (req.query.rootAccountId) filter.rootAccountId = req.query.rootAccountId;
    const rows = await SystemAuditEvent.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('actor', 'firstName lastName email')
      .lean();
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.setFeatureFlag = async (req, res) => {
  try {
    const { rootAccountId, key, enabled, value } = req.body || {};
    if (!rootAccountId || !key) {
      return res.status(400).json({ success: false, message: 'rootAccountId and key are required' });
    }
    const row = await AccountFeatureFlag.findOneAndUpdate(
      { rootAccountId, key },
      { $set: { enabled: Boolean(enabled), value: value ?? null } },
      { upsert: true, new: true }
    );
    return res.json({ success: true, data: row });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.ensureDefault = async (req, res) => {
  try {
    const root = await ensureDefaultRootAccount();
    await ensureQuota(root._id);
    clearTenantCache();
    return res.json({ success: true, data: root });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.listContactLeads = async (req, res) => {
  try {
    const status = req.query.status;
    const filter = status && status !== 'all' ? { status } : {};
    const leads = await ContactLead.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ success: true, count: leads.length, data: leads });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.provisionContactLead = async (req, res) => {
  try {
    const { host, code, adminPassword, planCode } = req.body || {};
    const result = await provisionFromContactLead(req.params.id, {
      host,
      code,
      adminPassword,
      planCode,
      provisionedBy: req.user._id,
    });
    return res.status(result.alreadyProvisioned ? 200 : 201).json({
      success: true,
      data: {
        account: result.account,
        adminUserId: result.adminUser?._id || null,
        temporaryPassword: result.temporaryPassword || null,
        lead: result.lead,
        alreadyProvisioned: result.alreadyProvisioned,
      },
    });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.requirePlatformAdmin = requirePlatformAdmin;
