/**
 * Provider-agnostic ID normalization (Phase P2).
 * Avoid scattering ObjectId/string assumptions across controllers.
 */

function normalizeId(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id != null) return String(value._id);
  if (typeof value.toString === 'function') return value.toString();
  return String(value);
}

function idsEqual(a, b) {
  if (a == null || b == null) return false;
  return normalizeId(a) === normalizeId(b);
}

module.exports = {
  normalizeId,
  idsEqual,
};
