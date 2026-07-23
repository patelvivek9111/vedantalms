const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Per-tenant SIS integration settings (CSV-first; ERP adapters stubbed).
 */
const sisIntegrationConfigSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ['csv', 'banner', 'peoplesoft', 'workday', 'fedena', 'mastersoft', 'custom_rest'],
      default: 'csv',
    },
    isSourceOfTruth: { type: Boolean, default: true },
    syncDirection: {
      type: String,
      enum: ['import', 'export', 'bidirectional'],
      default: 'bidirectional',
    },
    /** Manual first; cron string reserved for later workers */
    schedule: { type: String, default: 'manual' },
    fieldMappings: { type: mongoose.Schema.Types.Mixed, default: {} },
    credentialsRef: { type: String, default: '' },
    lastSyncAt: { type: Date, default: null },
    notes: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

sisIntegrationConfigSchema.plugin(tenantScopePlugin);
sisIntegrationConfigSchema.index(
  { rootAccountId: 1 },
  { unique: true, partialFilterExpression: { rootAccountId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('SisIntegrationConfig', sisIntegrationConfigSchema);
