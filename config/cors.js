function parseExtraOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getDevOrigins() {
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',
  ];
}

function getProductionOrigins(env = process.env) {
  const fromEnv = [env.FRONTEND_URL, ...parseExtraOrigins(env.CORS_EXTRA_ORIGINS)].filter(Boolean);
  // Primary: mysl8te.com. Keep vedantaed.com until old→new 301 cutover is done.
  const defaults = [
    'https://www.mysl8te.com',
    'https://mysl8te.com',
    'https://www.vedantaed.com',
    'https://vedantaed.com',
  ];
  return [...new Set([...defaults, ...fromEnv])];
}

function isLocalDevOrigin(origin, nodeEnv = process.env.NODE_ENV) {
  return (
    nodeEnv !== 'production' &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(origin)
  );
}

function isOriginAllowed(origin, options = {}) {
  if (!origin) return true;

  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const env = options.env ?? process.env;
  const isProd = nodeEnv === 'production';

  if (!isProd && isLocalDevOrigin(origin, nodeEnv)) return true;

  const allowedOrigins = isProd ? getProductionOrigins(env) : getDevOrigins();
  if (allowedOrigins.includes(origin)) return true;

  if (!isProd && (origin.endsWith('.onrender.com') || origin.endsWith('.vercel.app'))) {
    return true;
  }

  return false;
}

function createCorsOriginCallback(options = {}) {
  return function corsOrigin(origin, callback) {
    if (isOriginAllowed(origin, options)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  };
}

module.exports = {
  parseExtraOrigins,
  getDevOrigins,
  getProductionOrigins,
  isLocalDevOrigin,
  isOriginAllowed,
  createCorsOriginCallback,
};
