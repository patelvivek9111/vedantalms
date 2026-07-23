const { withTenantFilter, rootAccountIdFromRequest } = require('../../utils/tenantContext');
const { accountSubtreeFilter } = require('../tenancy/academicStructure.service');

/**
 * Build a User filter for registrar student queries.
 * department_admin is limited to their account subtree when scoped below root.
 */
async function buildStudentScopeFilter(req, extra = {}) {
  const tenantId = rootAccountIdFromRequest(req);
  const user = req.user;
  let filter = withTenantFilter({ role: 'student', ...extra }, tenantId);

  if (
    user?.role === 'department_admin' &&
    user.accountId &&
    tenantId &&
    String(user.accountId) !== String(tenantId)
  ) {
    const subtree = await accountSubtreeFilter(tenantId, user.accountId);
    filter = { ...filter, ...subtree, role: 'student', ...extra };
  }

  return { filter, tenantId };
}

/**
 * Account subtree scope for sections / courses / enrollments (dept_admin or ?accountId=).
 */
async function buildAccountScopeFilter(req, extra = {}) {
  const tenantId = rootAccountIdFromRequest(req);
  const user = req.user;
  const accountIdQuery = req.query?.accountId || req.body?.accountId;

  if (accountIdQuery) {
    const subtree = await accountSubtreeFilter(tenantId, accountIdQuery);
    return { filter: { ...subtree, ...extra }, tenantId };
  }

  if (
    user?.role === 'department_admin' &&
    user.accountId &&
    tenantId &&
    String(user.accountId) !== String(tenantId)
  ) {
    const subtree = await accountSubtreeFilter(tenantId, user.accountId);
    return { filter: { ...subtree, ...extra }, tenantId };
  }

  return { filter: withTenantFilter({ ...extra }, tenantId), tenantId };
}

function assertCanAccessStudentApi(req, res) {
  if (req.user?.role === 'student') {
    res.status(403).json({ success: false, message: 'Not authorized' });
    return false;
  }
  return true;
}

module.exports = {
  buildStudentScopeFilter,
  buildAccountScopeFilter,
  assertCanAccessStudentApi,
};
