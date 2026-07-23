const express = require('express');
const crypto = require('crypto');
const StudentHold = require('../models/studentHold.model');
const User = require('../models/user.model');
const { withTenantFilter, rootAccountIdFromRequest } = require('../utils/tenantContext');
const ltiAgs = require('../services/lti/ltiAgs.service');
const academicAuditService = require('../services/academicAudit.service');

const router = express.Router();

function verifyErpSecret(req) {
  const expected = process.env.ERP_HOLDS_WEBHOOK_SECRET || '';
  if (!expected) return true;
  const provided =
    req.get('x-erp-signature') ||
    req.get('x-webhook-secret') ||
    req.body?.secret ||
    '';
  if (!provided) return false;
  try {
    const a = Buffer.from(String(provided));
    const b = Buffer.from(String(expected));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * POST /api/integrations/erp/holds
 * Upsert hold by externalHoldId.
 */
router.post('/erp/holds', async (req, res) => {
  try {
    if (!verifyErpSecret(req)) {
      return res.status(401).json({ success: false, message: 'Invalid ERP webhook secret' });
    }

    const tenantId = rootAccountIdFromRequest(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant could not be resolved' });
    }

    const {
      externalHoldId,
      studentId,
      studentEmail,
      sisId,
      holdType = 'other',
      reason = 'ERP hold',
      active = true,
      blocksRegistration = true,
      blocksTranscript = false,
      blocksGrades = false,
    } = req.body || {};

    if (!externalHoldId) {
      return res.status(400).json({ success: false, message: 'externalHoldId is required' });
    }

    let student = null;
    if (studentId) {
      student = await User.findOne(withTenantFilter({ _id: studentId }, tenantId));
    } else if (sisId) {
      student = await User.findOne(
        withTenantFilter({ 'studentProfile.externalIds.sis': String(sisId).trim() }, tenantId)
      );
    } else if (studentEmail) {
      student = await User.findOne(
        withTenantFilter({ email: String(studentEmail).toLowerCase().trim() }, tenantId)
      );
    }
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in tenant' });
    }

    let hold = await StudentHold.findOne(
      withTenantFilter({ externalHoldId: String(externalHoldId) }, tenantId)
    );

    if (!active) {
      if (hold) {
        hold.isActive = false;
        hold.releasedAt = new Date();
        await hold.save();
      }
      return res.json({
        success: true,
        data: { action: hold ? 'released' : 'noop', hold },
      });
    }

    if (hold) {
      hold.holdType = holdType;
      hold.reason = reason;
      hold.blocksRegistration = Boolean(blocksRegistration);
      hold.blocksTranscript = Boolean(blocksTranscript);
      hold.blocksGrades = Boolean(blocksGrades);
      hold.isActive = true;
      hold.source = 'erp';
      await hold.save();
    } else {
      hold = await StudentHold.create({
        studentId: student._id,
        holdType,
        reason,
        blocksRegistration: Boolean(blocksRegistration),
        blocksTranscript: Boolean(blocksTranscript),
        blocksGrades: Boolean(blocksGrades),
        externalHoldId: String(externalHoldId),
        source: 'erp',
        placedBy: student._id,
        isActive: true,
        rootAccountId: tenantId,
        accountId: student.accountId || tenantId,
      });
    }

    await academicAuditService
      .recordAuditEvent({
        actorId: student._id,
        entityType: 'student_hold',
        entityId: hold._id,
        action: 'integrations.erp.hold_upserted',
        after: { externalHoldId, studentId: String(student._id), active: true },
        severity: 'info',
        rootAccountId: tenantId,
        metadata: { source: 'erp', externalHoldId },
      })
      .catch(() => {});

    return res.status(201).json({ success: true, data: { action: 'upserted', hold } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/lti/readiness', (req, res) => {
  return res.json({ success: true, data: ltiAgs.getAgsReadiness() });
});

router.post('/lti/ags/submit-stub', async (req, res) => {
  try {
    const tenantId = rootAccountIdFromRequest(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant could not be resolved' });
    }
    const data = await ltiAgs.submitScoresStub({
      tenantId,
      accountId: tenantId,
      term: req.body?.term,
      year: req.body?.year,
      rows: req.body?.rows || [],
      exportedBy: req.body?.exportedBy,
      dryRun: req.body?.dryRun !== false,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
