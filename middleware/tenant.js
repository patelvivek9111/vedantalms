const mongoose = require('mongoose');
const Account = require('../models/account.model');
const AccountDomain = require('../models/accountDomain.model');
const {
  runWithTenant,
  setRequestTenant,
} = require('../utils/tenantContext');
const { ensureDefaultRootAccount } = require('../services/tenancy/ensureDefaultRootAccount.service');

let defaultRootCache = { id: null, loadedAt: 0 };
const DEFAULT_CACHE_MS = 60_000;

async function resolveDefaultRootId() {
  const now = Date.now();
  if (defaultRootCache.id && now - defaultRootCache.loadedAt < DEFAULT_CACHE_MS) {
    return defaultRootCache.id;
  }
  const root = await ensureDefaultRootAccount();
  defaultRootCache = { id: root._id, loadedAt: now };
  return root._id;
}

function hostFromRequest(req) {
  const forwarded = req.get('x-forwarded-host');
  const raw = forwarded || req.get('host') || '';
  return AccountDomain.normalizeHost(raw.split(',')[0]);
}

/**
 * Resolve root Account from Host / X-Account-Id / fallback default.
 * Runs the rest of the request inside tenant AsyncLocalStorage.
 */
async function resolveTenant(req, res, next) {
  try {
    const host = hostFromRequest(req);
    let rootAccountId = null;
    let account = null;

    const headerAccountId = req.get('x-account-id') || req.query.accountId;
    if (headerAccountId && mongoose.isValidObjectId(String(headerAccountId))) {
      account = await Account.findOne({
        _id: headerAccountId,
        parentAccountId: null,
        workflowState: 'active',
      });
      if (account) rootAccountId = account._id;
    }

    if (!rootAccountId && host) {
      const domain = await AccountDomain.findOne({ host }).lean();
      if (domain) {
        const candidate = await Account.findOne({ _id: domain.rootAccountId });
        if (!candidate || candidate.workflowState !== 'active') {
          return res.status(404).json({
            success: false,
            message: 'Institution not available for this host',
          });
        }
        rootAccountId = candidate._id;
        account = candidate;
      }
    }

    if (!rootAccountId) {
      rootAccountId = await resolveDefaultRootId();
      account = (await Account.findById(rootAccountId)) || (await ensureDefaultRootAccount());
    }

    if (!account) {
      account = await Account.findById(rootAccountId);
    }

    const context = {
      rootAccountId,
      accountId: rootAccountId,
      account,
      host,
      isPlatformAdmin: false,
    };

    setRequestTenant(req, context);
    return runWithTenant(context, () => next());
  } catch (err) {
    console.error('resolveTenant failed:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to resolve institution for this request',
    });
  }
}

function clearTenantCache() {
  defaultRootCache = { id: null, loadedAt: 0 };
}

module.exports = {
  resolveTenant,
  hostFromRequest,
  clearTenantCache,
  resolveDefaultRootId,
};
