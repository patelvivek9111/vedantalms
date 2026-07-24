/**
 * Aggregated Office integration status (LTI AGS, ERP holds, board submit, SIS).
 */
async function getIntegrationsStatus(tenantId) {
  const ltiAgs = require('../lti/ltiAgs.service');
  const erpHold = require('../integrations/erpHoldWebhook.service');
  const boardSubmit = require('./boardSubmit.service');

  let sis = null;
  try {
    const sisSync = require('./sisSyncRunner.service');
    sis = await sisSync.getHealth(tenantId);
  } catch {
    sis = null;
  }

  let erpDlq = 0;
  try {
    const ErpHoldWebhookEvent = require('../../models/erpHoldWebhookEvent.model');
    erpDlq = await ErpHoldWebhookEvent.countDocuments({
      rootAccountId: tenantId,
      status: 'dead_letter',
    });
  } catch {
    erpDlq = 0;
  }

  const [ags, erp, board] = await Promise.all([
    ltiAgs.getAgsReadinessAsync(tenantId),
    Promise.resolve(erpHold.getErpHealth()),
    Promise.resolve(boardSubmit.getBoardHealth()),
  ]);

  return {
    ltiAgs: {
      enabled: ags.agsEnabled,
      ready: ags.platformReady,
      missing: ags.missing || [],
      note: ags.note,
      issuer: ags.issuer,
    },
    erpHolds: {
      ...erp,
      deadLetterCount: erpDlq,
    },
    boardSubmit: board,
    sis: sis
      ? {
          provider: sis.provider,
          schedule: sis.schedule,
          lastSyncAt: sis.lastSyncAt,
          lastSyncStatus: sis.lastSyncStatus,
          errorRate: sis.errorRate,
          openConflicts: sis.openConflicts,
        }
      : null,
  };
}

module.exports = { getIntegrationsStatus };
