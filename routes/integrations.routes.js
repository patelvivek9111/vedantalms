const express = require('express');
const { rootAccountIdFromRequest } = require('../utils/tenantContext');
const ltiAgs = require('../services/lti/ltiAgs.service');
const erpHoldWebhook = require('../services/integrations/erpHoldWebhook.service');
const { protect } = require('../middleware/auth');
const { requireCapability, CAPABILITIES } = require('../middleware/academicPermissions');

const router = express.Router();

/**
 * POST /api/integrations/erp/holds
 * HMAC or shared-secret auth → event log → apply (retry/DLQ on failure).
 */
router.post('/erp/holds', async (req, res) => {
  try {
    if (!erpHoldWebhook.requireSecretInProduction()) {
      return res.status(503).json({
        success: false,
        message: 'ERP_HOLDS_WEBHOOK_SECRET must be set in production',
        code: 'ERP_SECRET_REQUIRED',
      });
    }

    const auth = erpHoldWebhook.verifyErpAuth(req);
    if (!auth.ok) {
      return res.status(401).json({
        success: false,
        message: 'Invalid ERP webhook signature or secret',
        code: auth.reason || 'UNAUTHORIZED',
      });
    }

    const tenantId = rootAccountIdFromRequest(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant could not be resolved' });
    }

    const result = await erpHoldWebhook.ingestAndProcess({
      tenantId,
      payload: req.body || {},
      auth,
    });

    if (!result.ok) {
      const status = result.deadLetter ? 422 : result.statusCode || 500;
      return res.status(status).json({
        success: false,
        message: result.error,
        data: {
          eventId: result.event?._id,
          status: result.event?.status,
          attempts: result.event?.attempts,
          deadLetter: result.deadLetter,
        },
      });
    }

    return res.status(result.httpStatus || 201).json({
      success: true,
      data: {
        action: result.action,
        hold: result.hold,
        eventId: result.event?._id,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get(
  '/erp/holds/events',
  protect,
  requireCapability(CAPABILITIES.MANAGE_HOLDS),
  async (req, res) => {
    try {
      const tenantId = rootAccountIdFromRequest(req);
      const data = await erpHoldWebhook.listEvents(tenantId, {
        status: req.query.status,
        limit: req.query.limit,
      });
      return res.json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/erp/holds/events/:id/replay',
  protect,
  requireCapability(CAPABILITIES.MANAGE_HOLDS),
  async (req, res) => {
    try {
      const tenantId = rootAccountIdFromRequest(req);
      const result = await erpHoldWebhook.replayEvent(tenantId, req.params.id);
      if (!result.ok) {
        return res.status(result.statusCode || 500).json({
          success: false,
          message: result.error,
          data: { eventId: result.event?._id, status: result.event?.status },
        });
      }
      return res.json({
        success: true,
        data: { action: result.action, hold: result.hold, eventId: result.event?._id },
      });
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }
);

router.get('/lti/readiness', async (req, res) => {
  const tenantId = rootAccountIdFromRequest(req);
  const data = tenantId
    ? await ltiAgs.getAgsReadinessAsync(tenantId)
    : ltiAgs.getAgsReadiness();
  return res.json({ success: true, data });
});

async function handleAgsSubmit(req, res) {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant could not be resolved' });
    }
    const data = await ltiAgs.submitScores({
      tenantId,
      accountId: tenantId,
      term: req.body?.term,
      year: req.body?.year,
      rows: req.body?.rows || [],
      exportedBy: req.body?.exportedBy || req.user?._id,
      dryRun: req.body?.dryRun === true,
      courseId: req.body?.courseId || null,
      lineItemUrl: req.body?.lineItemUrl || null,
      label: req.body?.label || 'Final grade',
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
}

/** Live AGS submit */
router.post('/lti/ags/submit', handleAgsSubmit);
/** Backward-compatible alias */
router.post('/lti/ags/submit-stub', handleAgsSubmit);

router.post('/lti/ags/line-items/sync', async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant could not be resolved' });
    }
    const data = await ltiAgs.ensureLineItem({
      tenantId,
      accountId: tenantId,
      courseId: req.body?.courseId,
      sectionId: req.body?.sectionId,
      label: req.body?.label || 'Final grade',
      scoreMaximum: req.body?.scoreMaximum || 100,
      resourceLinkId: req.body?.resourceLinkId || '',
      dryRun: req.body?.dryRun === true,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
});

module.exports = router;
