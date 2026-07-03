const DEFAULT_DEV_JWT_SECRET = 'your-super-secret-jwt-key-123';

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret === DEFAULT_DEV_JWT_SECRET) {
      throw new Error('JWT_SECRET must be set to a strong secret in production');
    }
    return secret;
  }
  return secret || DEFAULT_DEV_JWT_SECRET;
}

module.exports = {
  DEFAULT_DEV_JWT_SECRET,
  resolveJwtSecret,
};
