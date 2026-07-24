/**
 * Orchestrates scheduled / manual SIS adapter pull → stage → optional apply → grade push.
 */
const SisIntegrationConfig = require('../../models/sisIntegrationConfig.model');
const SisJob = require('../../models/sisJob.model');
const SisSyncBatch = require('../../models/sisSyncBatch.model');
const SisSyncRow = require('../../models/sisSyncRow.model');
const SisStagingEnrollment = require('../../models/sisStagingEnrollment.model');
const crypto = require('crypto');
const { getAdapter, listAdapters } = require('../sis/adapters/registry');
const sisOffice = require('./sisOffice.service');
const academicAuditService = require('../academicAudit.service');

function newBatchId() {
  return crypto.randomBytes(8).toString('hex');
}

function isDue(schedule, lastSyncAt, now = new Date()) {
  const s = String(schedule || 'manual').toLowerCase().trim();
  if (!s || s === 'manual') return false;
  const last = lastSyncAt ? new Date(lastSyncAt).getTime() : 0;
  const elapsed = now.getTime() - last;
  if (s === 'hourly') return elapsed >= 60 * 60 * 1000;
  if (s === 'nightly') return elapsed >= 20 * 60 * 60 * 1000; // ~once per day window
  // Simple cron-ish: "0 * * * *" hourly, "0 2 * * *" nightly — treat unknown as nightly cadence
  if (/^\d/.test(s) || s.includes('*')) {
    return elapsed >= 20 * 60 * 60 * 1000;
  }
  return false;
}

async function markConfigSync(cfgDoc, { status, error }) {
  cfgDoc.lastSyncAt = new Date();
  cfgDoc.lastSyncStatus = status;
  cfgDoc.lastSyncError = error || '';
  if (status === 'failed') {
    cfgDoc.consecutiveFailures = (cfgDoc.consecutiveFailures || 0) + 1;
  } else {
    cfgDoc.consecutiveFailures = 0;
  }
  await cfgDoc.save();
}

/**
 * Run sync for one tenant config.
 * @param {object} opts
 * @param {string|object} opts.tenantId
 * @param {object} [opts.config] — lean or doc
 * @param {'import'|'export'|'bidirectional'|string} [opts.direction]
 * @param {boolean} [opts.dryRun]
 * @param {string[]} [opts.entityTypes]
 * @param {boolean} [opts.autoApply]
 * @param {object} [opts.actor]
 * @param {string} [opts.term]
 * @param {number|string} [opts.year]
 */
async function runSync({
  tenantId,
  config: configIn,
  direction,
  dryRun = false,
  entityTypes,
  autoApply = false,
  actor = null,
  term,
  year,
  forceLive = false,
} = {}) {
  const accountId = configIn?.accountId || tenantId;
  let cfgDoc = await SisIntegrationConfig.findOne({
    rootAccountId: tenantId,
  });
  if (!cfgDoc) {
    const created = await sisOffice.getOrCreateConfig(tenantId, accountId);
    cfgDoc = await SisIntegrationConfig.findById(created._id);
  }

  const cfg = cfgDoc.toObject();
  const provider = cfg.provider || 'csv';
  const adapter = getAdapter(provider);
  const dir = direction || cfg.syncDirection || 'bidirectional';
  const liveDryRun = forceLive ? false : dryRun;
  const results = {
    provider,
    direction: dir,
    dryRun: liveDryRun,
    pull: null,
    staged: {},
    apply: null,
    push: null,
    batchIds: [],
  };

  const jobBatchId = newBatchId();
  const jobProvider = [
    'banner',
    'peoplesoft',
    'workday',
    'csv',
    'custom_rest',
    'fedena',
    'mastersoft',
  ].includes(provider)
    ? provider
    : 'csv';

  await SisJob.create({
    jobType: 'scheduled_sync',
    provider: jobProvider,
    batchId: jobBatchId,
    status: 'running',
    createdBy: actor?._id || null,
    rootAccountId: tenantId,
    accountId: accountId || tenantId,
    meta: { direction: dir, dryRun: liveDryRun, schedule: cfg.schedule },
  });

  try {
    if (provider === 'csv') {
      await markConfigSync(cfgDoc, {
        status: 'skipped',
        error: 'csv provider — use Import tab or switch to a live connector',
      });
      await SisJob.findOneAndUpdate(
        { batchId: jobBatchId, rootAccountId: tenantId },
        {
          $set: {
            status: 'completed',
            notes: 'csv skipped',
            finishedAt: new Date(),
          },
        }
      );
      return { ...results, ok: true, skipped: true, message: 'csv has no HTTP sync' };
    }

    // —— Import / pull ——
    if (dir === 'import' || dir === 'bidirectional') {
      const pull = await adapter.pull({
        config: cfg,
        fieldMappings: cfg.fieldMappings,
        entityTypes: entityTypes || ['users', 'sections', 'enrollments'],
        dryRun: liveDryRun,
      });
      results.pull = {
        ok: pull.ok !== false,
        message: pull.message,
        dryRun: pull.dryRun,
        counts: {
          users: pull.users?.length || 0,
          sections: pull.sections?.length || 0,
          enrollments: pull.enrollments?.length || 0,
        },
      };

      if (!liveDryRun && pull.ok !== false) {
        if (pull.users?.length) {
          const r = await sisOffice.stageUsersImport({
            tenantId,
            accountId,
            rows: pull.users,
            provider,
            createdBy: actor?._id,
          });
          results.staged.users = r;
          results.batchIds.push(r.batchId);
        }
        if (pull.sections?.length) {
          const r = await sisOffice.stageSectionsImport({
            tenantId,
            accountId,
            rows: pull.sections,
            provider,
            createdBy: actor?._id,
          });
          results.staged.sections = r;
          results.batchIds.push(r.batchId);
        }
        if (pull.enrollments?.length) {
          const r = await sisOffice.stageEnrollmentsImport({
            tenantId,
            accountId,
            rows: pull.enrollments,
            provider,
            createdBy: actor?._id,
          });
          results.staged.enrollments = r;
          results.batchIds.push(r.batchId);
        }

        if (autoApply && results.batchIds.length) {
          const applyResults = [];
          for (const bid of results.batchIds) {
            applyResults.push(
              await sisOffice.applySyncBatch(bid, {
                tenantId,
                actorId: actor?._id || null,
                approvePending: true,
              })
            );
          }
          results.apply = applyResults;
        }
      }
    }

    // —— Export / push grades ——
    if (dir === 'export' || dir === 'bidirectional') {
      if (term && year) {
        const exported = await sisOffice.exportGradesPassback({
          tenantId,
          accountId,
          term,
          year,
          exportedBy: actor?._id,
          dryRun: liveDryRun,
          forceLive: forceLive || !liveDryRun,
        });
        results.push = {
          count: exported.count,
          batchId: exported.batchId,
          customRest: exported.customRest,
          adapterPush: exported.adapterPush,
        };
        if (exported.batchId) results.batchIds.push(exported.batchId);
      } else {
        results.push = {
          skipped: true,
          message: 'Export requires term+year (pass on manual run or schedule export separately)',
        };
      }
    }

    const failed =
      (results.pull && results.pull.ok === false) ||
      (results.push && results.push.adapterPush && results.push.adapterPush.ok === false);

    await markConfigSync(cfgDoc, {
      status: failed ? 'failed' : 'ok',
      error: failed
        ? results.pull?.message || results.push?.adapterPush?.message || 'sync failed'
        : '',
    });

    await SisJob.findOneAndUpdate(
      { batchId: jobBatchId, rootAccountId: tenantId },
      {
        $set: {
          status: failed ? 'failed' : 'completed',
          stagedCount: Object.values(results.staged).reduce((n, r) => n + (r?.staged || 0), 0),
          finishedAt: new Date(),
          meta: { ...results, direction: dir },
        },
      }
    );

    await academicAuditService
      .recordAuditEvent({
        actorId: actor?._id,
        entityType: 'sis_integration',
        entityId: cfgDoc._id,
        action: 'registrar.sis.sync_run',
        after: {
          provider,
          direction: dir,
          dryRun: liveDryRun,
          batchIds: results.batchIds,
          status: failed ? 'failed' : 'ok',
        },
        severity: failed ? 'warning' : 'info',
        rootAccountId: tenantId,
      })
      .catch(() => {});

    return { ...results, ok: !failed, syncJobBatchId: jobBatchId };
  } catch (err) {
    await markConfigSync(cfgDoc, { status: 'failed', error: err.message });
    await SisJob.findOneAndUpdate(
      { batchId: jobBatchId, rootAccountId: tenantId },
      {
        $set: {
          status: 'failed',
          notes: err.message,
          finishedAt: new Date(),
        },
      }
    );
    throw err;
  }
}

/**
 * Run due configs across all tenants (worker entry).
 */
async function runDueScheduledSyncs({ now = new Date(), dryRun = false } = {}) {
  const configs = await SisIntegrationConfig.find({
    isActive: true,
    schedule: { $nin: [null, '', 'manual'] },
    provider: { $nin: ['csv'] },
  });

  const reports = [];
  for (const cfg of configs) {
    if (!isDue(cfg.schedule, cfg.lastSyncAt, now)) {
      reports.push({
        tenantId: String(cfg.rootAccountId),
        provider: cfg.provider,
        skipped: true,
        reason: 'not_due',
      });
      continue;
    }
    try {
      const result = await runSync({
        tenantId: cfg.rootAccountId,
        config: cfg,
        dryRun,
        forceLive: !dryRun,
        autoApply: false,
      });
      reports.push({
        tenantId: String(cfg.rootAccountId),
        provider: cfg.provider,
        ok: result.ok,
        syncJobBatchId: result.syncJobBatchId,
        staged: result.staged,
      });
    } catch (err) {
      reports.push({
        tenantId: String(cfg.rootAccountId),
        provider: cfg.provider,
        ok: false,
        error: err.message,
      });
    }
  }
  return { ranAt: now.toISOString(), count: reports.length, reports };
}

async function getHealth(tenantId) {
  const cfg = await sisOffice.getOrCreateConfig(tenantId, tenantId);
  const recentJobs = await SisJob.find({ rootAccountId: tenantId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const last20 = recentJobs.slice(0, 20);
  const failed = last20.filter((j) => j.status === 'failed' || j.status === 'partial').length;
  const errorRate = last20.length ? Math.round((failed / last20.length) * 100) : 0;

  const [openConflicts, openErrors, rejectedLegacy] = await Promise.all([
    SisSyncRow.countDocuments({ rootAccountId: tenantId, status: 'conflict' }),
    SisSyncRow.countDocuments({
      rootAccountId: tenantId,
      $or: [{ status: 'rejected' }, { applyError: { $exists: true, $nin: [null, ''] } }],
    }),
    SisStagingEnrollment.countDocuments({
      rootAccountId: tenantId,
      $or: [{ status: 'rejected' }, { applyError: { $exists: true, $nin: [null, ''] } }],
    }),
  ]);

  const lastJob = recentJobs[0] || null;
  const adapter = getAdapter(cfg.provider);

  return {
    provider: cfg.provider,
    schedule: cfg.schedule,
    syncDirection: cfg.syncDirection,
    isActive: cfg.isActive,
    lastSyncAt: cfg.lastSyncAt,
    lastSyncStatus: cfg.lastSyncStatus || lastJob?.status || null,
    lastSyncError: cfg.lastSyncError || '',
    consecutiveFailures: cfg.consecutiveFailures || 0,
    errorRate,
    recentJobs: recentJobs.slice(0, 10).map((j) => ({
      _id: j._id,
      jobType: j.jobType,
      batchId: j.batchId,
      status: j.status,
      provider: j.provider,
      createdAt: j.createdAt,
      finishedAt: j.finishedAt,
      stagedCount: j.stagedCount,
      rejectedCount: j.rejectedCount,
      errorCount: j.errorCount,
    })),
    openConflicts,
    openErrors: openErrors + rejectedLegacy,
    credentialsConfigured: Boolean(cfg.credentialsRef),
    adapter: {
      id: adapter.id,
      label: adapter.label,
      capabilities: adapter.capabilities,
    },
  };
}

async function retryBatch(tenantId, batchId, { actor, approvePending = true } = {}) {
  const batch = await SisSyncBatch.findOne({ rootAccountId: tenantId, batchId });
  if (!batch) {
    const err = new Error('Batch not found');
    err.status = 404;
    throw err;
  }
  if (batch.entityType === 'grade_export') {
    const err = new Error('Grade export batches cannot be re-applied; run export again');
    err.status = 400;
    throw err;
  }

  // Reset failed/rejected sync rows to pending for retry (conflicts stay conflict)
  await SisSyncRow.updateMany(
    {
      rootAccountId: tenantId,
      batchId,
      status: { $in: ['rejected'] },
    },
    { $set: { status: 'pending', applyError: '' } }
  );

  const result = await sisOffice.applySyncBatch(batchId, {
    tenantId,
    actorId: actor?._id || null,
    approvePending,
  });

  await academicAuditService
    .recordAuditEvent({
      actorId: actor?._id,
      entityType: 'sis_sync_batch',
      entityId: batch._id,
      action: 'registrar.sis.batch_retry',
      after: result,
      severity: 'info',
      rootAccountId: tenantId,
      metadata: { batchId },
    })
    .catch(() => {});

  return result;
}

module.exports = {
  isDue,
  runSync,
  runDueScheduledSyncs,
  getHealth,
  retryBatch,
  listAdapters,
  getAdapter,
};
