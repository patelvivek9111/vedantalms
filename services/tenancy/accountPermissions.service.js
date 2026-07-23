const RoleOverride = require('../../models/roleOverride.model');
const { listAncestorAccountIds } = require('./accountMembership.service');

/** Base account-management permissions (Phase 2 front door). */
const ACCOUNT_PERMISSIONS = {
  MANAGE_USERS: 'manage_account_users',
  INVITE_USERS: 'invite_account_users',
  MANAGE_BRAND: 'manage_account_brand',
  MANAGE_AUTH_PROVIDERS: 'manage_auth_providers',
  VIEW_ACCOUNT_SETTINGS: 'view_account_settings',
  MANAGE_SUB_ACCOUNTS: 'manage_sub_accounts',
};

const BASE_ROLE_PERMISSIONS = {
  student: [],
  teaching_assistant: [],
  teacher: [ACCOUNT_PERMISSIONS.VIEW_ACCOUNT_SETTINGS],
  designer: [ACCOUNT_PERMISSIONS.VIEW_ACCOUNT_SETTINGS],
  observer: [],
  department_admin: [
    ACCOUNT_PERMISSIONS.VIEW_ACCOUNT_SETTINGS,
    ACCOUNT_PERMISSIONS.INVITE_USERS,
    ACCOUNT_PERMISSIONS.MANAGE_USERS,
  ],
  registrar: [
    ACCOUNT_PERMISSIONS.VIEW_ACCOUNT_SETTINGS,
    ACCOUNT_PERMISSIONS.INVITE_USERS,
  ],
  admin: [
    ACCOUNT_PERMISSIONS.MANAGE_USERS,
    ACCOUNT_PERMISSIONS.INVITE_USERS,
    ACCOUNT_PERMISSIONS.MANAGE_BRAND,
    ACCOUNT_PERMISSIONS.MANAGE_AUTH_PROVIDERS,
    ACCOUNT_PERMISSIONS.VIEW_ACCOUNT_SETTINGS,
    ACCOUNT_PERMISSIONS.MANAGE_SUB_ACCOUNTS,
  ],
  platform_admin: Object.values(ACCOUNT_PERMISSIONS),
};

function basePermissionsForRole(role) {
  return new Set(BASE_ROLE_PERMISSIONS[role] || []);
}

/**
 * Resolve effective permissions for roles at an account, walking ancestors for overrides.
 * Child overrides win over parent for the same permission key.
 */
async function resolvePermissions({ roles, accountId }) {
  const effective = new Set();
  for (const role of roles || []) {
    for (const p of basePermissionsForRole(role)) effective.add(p);
  }

  if (!accountId) return effective;

  const ancestors = await listAncestorAccountIds(accountId);
  // Walk root → leaf so child overrides win
  const ordered = [...ancestors].reverse();
  const overrides = await RoleOverride.find({
    accountId: { $in: ordered },
    role: { $in: roles || [] },
  }).lean();

  const byAccount = new Map();
  for (const row of overrides) {
    const key = String(row.accountId);
    if (!byAccount.has(key)) byAccount.set(key, []);
    byAccount.get(key).push(row);
  }

  for (const id of ordered) {
    for (const row of byAccount.get(String(id)) || []) {
      if (row.enabled) effective.add(row.permission);
      else effective.delete(row.permission);
    }
  }

  return effective;
}

async function can({ roles, accountId, permission }) {
  const set = await resolvePermissions({ roles, accountId });
  return set.has(permission);
}

module.exports = {
  ACCOUNT_PERMISSIONS,
  BASE_ROLE_PERMISSIONS,
  resolvePermissions,
  can,
};
