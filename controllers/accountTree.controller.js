const Account = require('../models/account.model');
const Course = require('../models/course.model');
const { rootAccountIdFromRequest, withTenantFilter } = require('../utils/tenantContext');
const {
  resolvePermissions,
  ACCOUNT_PERMISSIONS,
} = require('../services/tenancy/accountPermissions.service');

async function assertManageSubAccounts(req) {
  if (['admin', 'platform_admin'].includes(req.user?.role)) return;
  const perms = await resolvePermissions({
    roles: [req.user.role],
    accountId: rootAccountIdFromRequest(req),
  });
  if (!perms.has(ACCOUNT_PERMISSIONS.MANAGE_SUB_ACCOUNTS)) {
    const err = new Error('Missing permission to manage sub-accounts');
    err.status = 403;
    throw err;
  }
}

async function collectDescendantIds(rootId, parentId) {
  const children = await Account.find({
    rootAccountId: rootId,
    parentAccountId: parentId,
    workflowState: { $ne: 'deleted' },
  })
    .select('_id')
    .lean();
  const ids = [parentId];
  for (const child of children) {
    const nested = await collectDescendantIds(rootId, child._id);
    ids.push(...nested.filter((id) => String(id) !== String(child._id)));
    ids.push(child._id);
  }
  return [...new Set(ids.map(String))].map((id) => id);
}

exports.listAccountTree = async (req, res) => {
  try {
    const rootId = rootAccountIdFromRequest(req);
    const accounts = await Account.find({
      rootAccountId: rootId,
      workflowState: { $ne: 'deleted' },
    })
      .sort({ parentAccountId: 1, name: 1 })
      .lean();

    const byParent = new Map();
    for (const a of accounts) {
      const key = a.parentAccountId ? String(a.parentAccountId) : 'root';
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(a);
    }

    function build(nodeId) {
      const kids = byParent.get(String(nodeId)) || [];
      return kids.map((k) => ({
        ...k,
        children: build(k._id),
      }));
    }

    const root = accounts.find((a) => String(a._id) === String(rootId));
    const tree = root
      ? [{ ...root, children: build(root._id) }]
      : build(rootId);

    return res.json({ success: true, data: { flat: accounts, tree } });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.createSubAccount = async (req, res) => {
  try {
    await assertManageSubAccounts(req);
    const rootId = rootAccountIdFromRequest(req);
    const { name, code, parentAccountId } = req.body || {};
    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }

    const parent = parentAccountId
      ? await Account.findOne({ _id: parentAccountId, rootAccountId: rootId })
      : await Account.findById(rootId);
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent account not found' });
    }

    const account = await Account.create({
      name: String(name).trim(),
      code: String(code || `${parent.code || 'SUB'}-${Date.now().toString(36)}`)
        .trim()
        .toUpperCase()
        .slice(0, 64),
      parentAccountId: parent._id,
      rootAccountId: rootId,
      institutionMode: parent.institutionMode,
      timezone: parent.timezone,
      workflowState: 'active',
    });

    return res.status(201).json({ success: true, data: account });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.updateSubAccount = async (req, res) => {
  try {
    await assertManageSubAccounts(req);
    const rootId = rootAccountIdFromRequest(req);
    const account = await Account.findOne({
      _id: req.params.id,
      rootAccountId: rootId,
      workflowState: { $ne: 'deleted' },
    });
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    if (String(account._id) === String(rootId) && req.body?.parentAccountId) {
      return res.status(400).json({ success: false, message: 'Cannot reparent the root account' });
    }

    const { name, timezone, parentAccountId, workflowState } = req.body || {};
    if (name != null) account.name = String(name).trim();
    if (timezone != null) account.timezone = timezone;
    if (workflowState && ['active', 'suspended', 'deleted'].includes(workflowState)) {
      if (String(account._id) === String(rootId) && workflowState === 'deleted') {
        return res.status(400).json({ success: false, message: 'Use platform offboard for root' });
      }
      account.workflowState = workflowState;
    }
    if (parentAccountId) {
      const parent = await Account.findOne({ _id: parentAccountId, rootAccountId: rootId });
      if (!parent) return res.status(404).json({ success: false, message: 'Parent not found' });
      if (String(parent._id) === String(account._id)) {
        return res.status(400).json({ success: false, message: 'Cannot parent to self' });
      }
      account.parentAccountId = parent._id;
    }
    await account.save();
    return res.json({ success: true, data: account });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.moveCoursesToAccount = async (req, res) => {
  try {
    await assertManageSubAccounts(req);
    const rootId = rootAccountIdFromRequest(req);
    const { courseIds, accountId } = req.body || {};
    if (!accountId || !Array.isArray(courseIds) || !courseIds.length) {
      return res.status(400).json({ success: false, message: 'accountId and courseIds[] required' });
    }
    const account = await Account.findOne({ _id: accountId, rootAccountId: rootId });
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });

    const result = await Course.updateMany(
      withTenantFilter({ _id: { $in: courseIds } }, rootId),
      { $set: { accountId: account._id } }
    );
    return res.json({
      success: true,
      data: { matched: result.matchedCount ?? result.n, modified: result.modifiedCount ?? result.nModified },
    });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.collectDescendantIds = collectDescendantIds;
