const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const opsController = require('../controllers/ops.controller');
const fileRecoveryController = require('../controllers/fileRecovery.controller');

router.get(
  '/dashboard',
  protect,
  authorize('admin', 'registrar', 'department_admin'),
  opsController.getOpsDashboard
);

router.get(
  '/files',
  protect,
  authorize('admin', 'registrar', 'department_admin'),
  opsController.getFileOps
);

router.get(
  '/recovery',
  protect,
  authorize('admin', 'registrar', 'department_admin'),
  opsController.getRecoverySummary
);

router.post(
  '/recovery',
  protect,
  authorize('admin', 'registrar', 'department_admin'),
  opsController.postRecoveryAction
);

router.post(
  '/jobs/:id/retry',
  protect,
  authorize('admin', 'registrar', 'department_admin'),
  opsController.retryJob
);

router.delete(
  '/jobs/:id',
  protect,
  authorize('admin', 'registrar', 'department_admin'),
  opsController.dismissJob
);

router.get(
  '/recovery/files',
  protect,
  authorize('admin', 'registrar', 'department_admin'),
  fileRecoveryController.listFiles
);

router.get(
  '/recovery/files/:id/audit',
  protect,
  authorize('admin', 'registrar', 'department_admin'),
  fileRecoveryController.getAuditTimeline
);

router.get(
  '/recovery/files/:id/versions',
  protect,
  authorize('admin', 'registrar', 'department_admin'),
  fileRecoveryController.getVersions
);

router.get(
  '/recovery/files/:id/restore-preview',
  protect,
  authorize('admin', 'registrar', 'department_admin'),
  fileRecoveryController.previewRestore
);

router.post(
  '/recovery/files/:id/restore',
  protect,
  authorize('admin', 'registrar', 'department_admin'),
  fileRecoveryController.restoreFile
);

router.post(
  '/recovery/files/:id/restore-version',
  protect,
  authorize('admin', 'registrar', 'department_admin'),
  fileRecoveryController.restoreVersion
);

router.post(
  '/recovery/files/:id/quarantine',
  protect,
  authorize('admin', 'registrar', 'department_admin'),
  fileRecoveryController.quarantine
);

router.post(
  '/recovery/files/:id/release',
  protect,
  authorize('admin', 'registrar', 'department_admin'),
  fileRecoveryController.release
);

router.post(
  '/recovery/bulk',
  protect,
  authorize('admin', 'registrar', 'department_admin'),
  fileRecoveryController.bulkAction
);

const fileGovernanceEngine = require('../services/fileGovernanceEngine.service');

router.get(
  '/governance',
  protect,
  authorize('admin', 'registrar', 'department_admin'),
  async (req, res) => {
    try {
      const data = await fileGovernanceEngine.getGovernanceReport();
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }
);

router.post(
  '/governance/legal-hold/:fileAssetId',
  protect,
  authorize('admin', 'registrar', 'department_admin'),
  async (req, res) => {
    try {
      const asset = await fileGovernanceEngine.setLegalHold(
        req.params.fileAssetId,
        req.user,
        { hold: req.body.hold !== false, reason: req.body.reason },
        { ip: req.ip }
      );
      res.json({ success: true, data: asset });
    } catch (e) {
      res.status(e.statusCode || 500).json({ success: false, message: e.message });
    }
  }
);

module.exports = router;
