const Account = require('../../models/account.model');
const AccountUser = require('../../models/accountUser.model');
const Pseudonym = require('../../models/pseudonym.model');
const AuthenticationProvider = require('../../models/authenticationProvider.model');

/**
 * Ensure Canvas-style membership + login identity for a user in a root account.
 */
async function ensureAccountMembership({
  user,
  rootAccountId,
  accountId,
  role,
}) {
  if (!user?._id || !rootAccountId) {
    throw new Error('user and rootAccountId are required');
  }

  const rid = rootAccountId;
  const aid = accountId || rootAccountId;
  const primaryRole = role || user.role || 'student';

  const provider = await AuthenticationProvider.ensurePasswordProvider(rid);

  let membership = await AccountUser.findOne({ userId: user._id, accountId: aid });
  if (!membership) {
    membership = await AccountUser.create({
      userId: user._id,
      accountId: aid,
      rootAccountId: rid,
      roles: [primaryRole],
      workflowState: 'active',
    });
  } else if (membership.workflowState !== 'active') {
    membership.workflowState = 'active';
    if (!membership.roles.includes(primaryRole)) {
      membership.roles = [...new Set([primaryRole, ...membership.roles])];
    }
    await membership.save();
  } else if (primaryRole && !membership.roles.includes(primaryRole)) {
    membership.roles = [...new Set([primaryRole, ...membership.roles])];
    await membership.save();
  }

  const uniqueId = String(user.email || '').toLowerCase().trim();
  if (uniqueId) {
    let pseudo = await Pseudonym.findOne({ rootAccountId: rid, uniqueId });
    if (!pseudo) {
      await Pseudonym.create({
        userId: user._id,
        rootAccountId: rid,
        uniqueId,
        workflowState: 'active',
        authenticationProviderId: provider._id,
      });
    } else if (String(pseudo.userId) !== String(user._id)) {
      throw new Error('Login id already belongs to another user in this institution');
    } else if (pseudo.workflowState !== 'active') {
      pseudo.workflowState = 'active';
      await pseudo.save();
    }
  }

  if (!user.rootAccountId || String(user.rootAccountId) !== String(rid)) {
    user.rootAccountId = rid;
    user.accountId = aid;
    await user.save();
  }

  return membership;
}

async function listAncestorAccountIds(accountId) {
  const ids = [];
  let current = await Account.findById(accountId).select('parentAccountId rootAccountId').lean();
  let guard = 0;
  while (current && guard < 32) {
    ids.push(current._id);
    if (!current.parentAccountId) break;
    current = await Account.findById(current.parentAccountId).select('parentAccountId rootAccountId').lean();
    guard += 1;
  }
  return ids;
}

async function userHasRoleInAccountTree(userId, accountId, roles) {
  const wanted = new Set((Array.isArray(roles) ? roles : [roles]).filter(Boolean));
  if (!wanted.size) return false;
  const ancestors = await listAncestorAccountIds(accountId);
  const memberships = await AccountUser.find({
    userId,
    accountId: { $in: ancestors },
    workflowState: 'active',
  })
    .select('roles')
    .lean();
  return memberships.some((m) => (m.roles || []).some((r) => wanted.has(r)));
}

async function findUserByLoginId(rootAccountId, uniqueId) {
  const id = String(uniqueId || '').toLowerCase().trim();
  if (!rootAccountId || !id) return null;

  const pseudo = await Pseudonym.findOne({
    rootAccountId,
    uniqueId: id,
    workflowState: 'active',
  }).lean();

  if (pseudo) {
    const User = require('../../models/user.model');
    return User.findById(pseudo.userId).select('+password');
  }

  return null;
}

module.exports = {
  ensureAccountMembership,
  listAncestorAccountIds,
  userHasRoleInAccountTree,
  findUserByLoginId,
};
