const mongoose = require('mongoose');
const { getTenantRootAccountId, getTenantContext } = require('../../utils/tenantContext');

/**
 * Canvas-style tenancy fields + save-time defaults from AsyncLocalStorage.
 * Does NOT auto-filter queries (too risky for jobs/migrations) — use withTenantFilter.
 */
function tenantScopePlugin(schema, options = {}) {
  const { optionalOnRead = true, skipDefaultIndexes = false } = options;

  if (!schema.path('rootAccountId')) {
    schema.add({
      rootAccountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        required: false,
      },
    });
  }

  if (!schema.path('accountId')) {
    schema.add({
      accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        required: false,
      },
    });
  }

  schema.pre('validate', function (next) {
    const ctx = getTenantContext();
    const fromCtx = ctx?.rootAccountId || getTenantRootAccountId();
    if (!this.rootAccountId && fromCtx) {
      this.rootAccountId = fromCtx;
    }
    if (!this.accountId) {
      this.accountId = ctx?.accountId || this.rootAccountId || fromCtx || undefined;
    }
    if (!optionalOnRead && !this.rootAccountId) {
      return next(new Error('rootAccountId is required'));
    }
    return next();
  });

  if (!skipDefaultIndexes) {
    schema.index({ rootAccountId: 1 });
    schema.index({ accountId: 1 });
  }
}

module.exports = { tenantScopePlugin };
