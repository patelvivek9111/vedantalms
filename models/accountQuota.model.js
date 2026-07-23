const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Per-root plan + hard quotas (Canvas Cloud style).
 */
const PLAN_CODES = ['free', 'starter', 'standard', 'enterprise'];

const accountQuotaSchema = new mongoose.Schema(
  {
    planCode: {
      type: String,
      enum: PLAN_CODES,
      default: 'standard',
    },
    maxSeats: { type: Number, default: 500, min: 1 },
    maxStorageBytes: {
      type: Number,
      default: 50 * 1024 * 1024 * 1024, // 50 GB
      min: 0,
    },
    apiRateLimitPerMinute: { type: Number, default: 600, min: 10 },
    storageUsedBytes: { type: Number, default: 0, min: 0 },
    seatsUsed: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: '', trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

accountQuotaSchema.plugin(tenantScopePlugin);

accountQuotaSchema.index(
  { rootAccountId: 1 },
  { unique: true, partialFilterExpression: { rootAccountId: { $type: 'objectId' } } }
);

accountQuotaSchema.statics.PLAN_CODES = PLAN_CODES;

accountQuotaSchema.statics.defaultsForPlan = function defaultsForPlan(planCode = 'standard') {
  const plans = {
    free: { maxSeats: 50, maxStorageBytes: 5 * 1024 ** 3, apiRateLimitPerMinute: 120 },
    starter: { maxSeats: 200, maxStorageBytes: 25 * 1024 ** 3, apiRateLimitPerMinute: 300 },
    standard: { maxSeats: 500, maxStorageBytes: 50 * 1024 ** 3, apiRateLimitPerMinute: 600 },
    enterprise: { maxSeats: 10000, maxStorageBytes: 500 * 1024 ** 3, apiRateLimitPerMinute: 3000 },
  };
  return plans[planCode] || plans.standard;
};

module.exports = mongoose.model('AccountQuota', accountQuotaSchema);
