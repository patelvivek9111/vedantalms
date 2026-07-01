const AUTH_COOKIE_NAME = 'lms_auth';

function parseJwtExpireMs() {
  const raw = process.env.JWT_EXPIRE || '7d';
  const match = /^(\d+)([dhms])$/.exec(String(raw).trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
  return n * (multipliers[unit] || 86400000);
}

function useSecureAuthCookies() {
  if (process.env.AUTH_COOKIE_SECURE === 'true') return true;
  if (process.env.AUTH_COOKIE_SECURE === 'false') return false;
  const frontend = process.env.FRONTEND_URL || '';
  return frontend.startsWith('https://');
}

function authCookieOptions() {
  const secure = useSecureAuthCookies();
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'strict' : 'lax',
    path: '/',
    maxAge: parseJwtExpireMs(),
  };
}

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
}

function clearAuthCookie(res) {
  const secure = useSecureAuthCookies();
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'strict' : 'lax',
    path: '/',
  });
}

function extractTokenFromRequest(req) {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }
  if (req.cookies && req.cookies[AUTH_COOKIE_NAME]) {
    return req.cookies[AUTH_COOKIE_NAME];
  }
  return null;
}

function extractTokenFromSocketHandshake(socket) {
  const fromAuth = socket.handshake?.auth?.token;
  if (fromAuth) return fromAuth;

  const fromHeader = socket.handshake?.headers?.authorization;
  if (fromHeader && fromHeader.startsWith('Bearer ')) {
    return fromHeader.split(' ')[1];
  }

  const cookieHeader = socket.handshake?.headers?.cookie;
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [name, ...rest] = part.trim().split('=');
    if (name === AUTH_COOKIE_NAME) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

module.exports = {
  AUTH_COOKIE_NAME,
  setAuthCookie,
  clearAuthCookie,
  extractTokenFromRequest,
  extractTokenFromSocketHandshake,
};
