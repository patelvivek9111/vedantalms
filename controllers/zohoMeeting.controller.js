const axios = require('axios');
const ZohoMeetingConnection = require('../models/zohoMeetingConnection.model');

const getZohoConfig = () => {
  const regionBase = process.env.ZOHO_ACCOUNTS_BASE_URL || 'https://accounts.zoho.com';
  return {
    clientId: process.env.ZOHO_CLIENT_ID || '',
    clientSecret: process.env.ZOHO_CLIENT_SECRET || '',
    redirectUri: process.env.ZOHO_REDIRECT_URI || '',
    scope: process.env.ZOHO_SCOPE || 'ZohoMeeting.meeting.ALL',
    authUrl: `${regionBase}/oauth/v2/auth`,
    tokenUrl: `${regionBase}/oauth/v2/token`,
    frontendRedirect: process.env.ZOHO_FRONTEND_REDIRECT_URL || (process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/groups` : 'http://localhost:3000/groups'),
  };
};

const encodeState = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64url');
const decodeState = (value) => {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

exports.getStatus = async (req, res) => {
  const conn = await ZohoMeetingConnection.findOne({ user: req.user._id }).select('accountEmail expiresAt updatedAt');
  res.json({
    success: true,
    connected: !!conn,
    data: conn
      ? {
          accountEmail: conn.accountEmail || '',
          expiresAt: conn.expiresAt,
          updatedAt: conn.updatedAt,
        }
      : null,
  });
};

exports.getAuthUrl = async (req, res) => {
  const cfg = getZohoConfig();
  if (!cfg.clientId || !cfg.redirectUri) {
    return res.status(400).json({ success: false, message: 'Zoho OAuth is not configured on server' });
  }
  const state = encodeState({
    uid: req.user._id.toString(),
    t: Date.now(),
  });
  const url = `${cfg.authUrl}?response_type=code&client_id=${encodeURIComponent(cfg.clientId)}&scope=${encodeURIComponent(cfg.scope)}&redirect_uri=${encodeURIComponent(cfg.redirectUri)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
  res.json({ success: true, authUrl: url });
};

exports.handleCallback = async (req, res) => {
  const cfg = getZohoConfig();
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${cfg.frontendRedirect}?zoho=error&reason=${encodeURIComponent(String(error))}`);
  }
  if (!code || !state) {
    return res.redirect(`${cfg.frontendRedirect}?zoho=error&reason=missing_code_or_state`);
  }
  if (!cfg.clientId || !cfg.clientSecret || !cfg.redirectUri) {
    return res.redirect(`${cfg.frontendRedirect}?zoho=error&reason=oauth_not_configured`);
  }

  const parsed = decodeState(String(state));
  if (!parsed?.uid) {
    return res.redirect(`${cfg.frontendRedirect}?zoho=error&reason=invalid_state`);
  }

  try {
    const tokenRes = await axios.post(
      cfg.tokenUrl,
      null,
      {
        params: {
          grant_type: 'authorization_code',
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          redirect_uri: cfg.redirectUri,
          code: String(code),
        },
      }
    );

    const tokenData = tokenRes.data || {};
    const expiresIn = Number(tokenData.expires_in || tokenData.expires_in_sec || 0);
    const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null;

    await ZohoMeetingConnection.findOneAndUpdate(
      { user: parsed.uid },
      {
        user: parsed.uid,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || '',
        tokenType: tokenData.token_type || 'Bearer',
        scope: tokenData.scope || '',
        expiresAt,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.redirect(`${cfg.frontendRedirect}?zoho=connected`);
  } catch (e) {
    return res.redirect(`${cfg.frontendRedirect}?zoho=error&reason=token_exchange_failed`);
  }
};

exports.disconnect = async (req, res) => {
  await ZohoMeetingConnection.findOneAndDelete({ user: req.user._id });
  res.json({ success: true, message: 'Zoho disconnected' });
};
