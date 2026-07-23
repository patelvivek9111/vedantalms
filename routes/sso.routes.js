const express = require('express');
const AuthenticationProvider = require('../models/authenticationProvider.model');
const { rootAccountIdFromRequest } = require('../utils/tenantContext');
const { beginOidcLogin, completeOidcLogin } = require('../services/tenancy/oidc.service');
const { beginSamlLogin, completeSamlLogin } = require('../services/tenancy/saml.service');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

function publicApiBase(req) {
  const configured = process.env.API_PUBLIC_URL || process.env.BACKEND_URL;
  if (configured) return configured.replace(/\/$/, '');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}`;
}

function frontendBase() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/** List active SSO providers for current tenant (public). */
router.get('/sso/providers', async (req, res) => {
  try {
    const rootId = rootAccountIdFromRequest(req);
    const providers = await AuthenticationProvider.find({
      rootAccountId: rootId,
      workflowState: 'active',
      authType: { $in: ['password', 'google', 'microsoft', 'oidc', 'saml'] },
    })
      .select('authType name position jitProvisioning')
      .sort({ position: 1 })
      .lean();
    return res.json({ success: true, data: providers });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/sso/oidc/:providerId/start', async (req, res) => {
  try {
    const rootId = rootAccountIdFromRequest(req);
    const redirectUri = `${publicApiBase(req)}/api/auth/sso/oidc/${req.params.providerId}/callback`;
    const { authorizationUrl } = await beginOidcLogin({
      providerId: req.params.providerId,
      rootAccountId: rootId,
      redirectUri,
      returnTo: req.query.returnTo,
    });
    return res.redirect(authorizationUrl);
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.get('/sso/oidc/:providerId/callback', async (req, res) => {
  try {
    const rootId = rootAccountIdFromRequest(req);
    const redirectUri = `${publicApiBase(req)}/api/auth/sso/oidc/${req.params.providerId}/callback`;
    const result = await completeOidcLogin({
      providerId: req.params.providerId,
      rootAccountId: rootId,
      redirectUri,
      query: req.query,
    });
    const target = `${frontendBase()}/login?ssoToken=${encodeURIComponent(result.token)}&returnTo=${encodeURIComponent(result.returnTo || '/')}`;
    return res.redirect(target);
  } catch (err) {
    const target = `${frontendBase()}/login?ssoError=${encodeURIComponent(err.message)}`;
    return res.redirect(target);
  }
});

router.get('/sso/saml/:providerId/start', async (req, res) => {
  try {
    const rootId = rootAccountIdFromRequest(req);
    const acsUrl = `${publicApiBase(req)}/api/auth/sso/saml/${req.params.providerId}/acs`;
    const { redirectUrl } = await beginSamlLogin({
      providerId: req.params.providerId,
      rootAccountId: rootId,
      acsUrl,
    });
    return res.redirect(redirectUrl);
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.post('/sso/saml/:providerId/acs', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const rootId = rootAccountIdFromRequest(req);
    const result = await completeSamlLogin({
      providerId: req.params.providerId,
      rootAccountId: rootId,
      SAMLResponse: req.body.SAMLResponse,
    });
    const target = `${frontendBase()}/login?ssoToken=${encodeURIComponent(result.token)}`;
    return res.redirect(target);
  } catch (err) {
    const target = `${frontendBase()}/login?ssoError=${encodeURIComponent(err.message)}`;
    return res.redirect(target);
  }
});

/** Platform/school admin: upsert SSO provider config */
router.post('/sso/providers', protect, authorize('admin', 'platform_admin'), async (req, res) => {
  try {
    const rootId = rootAccountIdFromRequest(req);
    const { authType, name, settings, jitProvisioning, position, providerId } = req.body || {};
    if (!authType) {
      return res.status(400).json({ success: false, message: 'authType is required' });
    }
    let doc;
    if (providerId) {
      doc = await AuthenticationProvider.findOneAndUpdate(
        { _id: providerId, rootAccountId: rootId },
        {
          $set: {
            name: name || authType,
            settings: settings || {},
            jitProvisioning: Boolean(jitProvisioning),
            position: position || 0,
            workflowState: 'active',
          },
        },
        { new: true }
      );
    } else {
      doc = await AuthenticationProvider.create({
        rootAccountId: rootId,
        authType,
        name: name || authType,
        settings: settings || {},
        jitProvisioning: Boolean(jitProvisioning),
        position: position || 0,
      });
    }
    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
