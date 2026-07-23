const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const platformController = require('../controllers/platform.controller');

const router = express.Router();

router.get('/tenant/current', platformController.getCurrentTenant);

router.get(
  '/platform/accounts',
  protect,
  authorize('platform_admin'),
  platformController.listAccounts
);

router.post(
  '/platform/accounts',
  protect,
  authorize('platform_admin'),
  platformController.createRootAccount
);

router.patch(
  '/platform/accounts/:id',
  protect,
  authorize('platform_admin'),
  platformController.updateRootAccount
);

router.get(
  '/platform/accounts/:id/quota',
  protect,
  authorize('platform_admin'),
  platformController.getAccountQuota
);

router.put(
  '/platform/accounts/:id/quota',
  protect,
  authorize('platform_admin'),
  platformController.putAccountQuota
);

router.post(
  '/platform/accounts/:id/domains',
  protect,
  authorize('platform_admin'),
  platformController.addAccountDomain
);

router.post(
  '/platform/accounts/:id/domains/:domainId/verify-request',
  protect,
  authorize('platform_admin'),
  platformController.requestDomainVerification
);

router.post(
  '/platform/accounts/:id/domains/:domainId/verify',
  protect,
  authorize('platform_admin'),
  platformController.verifyAccountDomain
);

router.post(
  '/platform/accounts/:id/export',
  protect,
  authorize('platform_admin'),
  platformController.exportAccount
);

router.post(
  '/platform/accounts/:id/offboard',
  protect,
  authorize('platform_admin'),
  platformController.offboardAccount
);

router.post(
  '/platform/impersonate',
  protect,
  authorize('platform_admin'),
  platformController.startImpersonation
);

router.post(
  '/platform/impersonate/end',
  protect,
  authorize('platform_admin'),
  platformController.endImpersonation
);

router.get(
  '/platform/impersonate/audit',
  protect,
  authorize('platform_admin'),
  platformController.listImpersonationAudit
);

router.post(
  '/platform/domains/tls-callback',
  platformController.tlsCallback
);

router.post(
  '/platform/feature-flags',
  protect,
  authorize('platform_admin'),
  platformController.setFeatureFlag
);

router.post(
  '/platform/ensure-default-account',
  protect,
  authorize('platform_admin'),
  platformController.ensureDefault
);

router.get(
  '/platform/leads',
  protect,
  authorize('platform_admin'),
  platformController.listContactLeads
);

router.post(
  '/platform/leads/:id/provision',
  protect,
  authorize('platform_admin'),
  platformController.provisionContactLead
);

module.exports = router;
