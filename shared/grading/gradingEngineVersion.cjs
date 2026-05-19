/**
 * Semantic version of the shared grading engine (calculator + policy resolution).
 * Bump MINOR when policy-aware behavior changes; bump MAJOR only with migration plan.
 */
const GRADING_ENGINE_VERSION = '1.0.0';

function getGradingEngineVersion() {
  return GRADING_ENGINE_VERSION;
}

function parseEngineVersion(version) {
  const parts = String(version || '')
    .split('.')
    .map((n) => parseInt(n, 10));
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
}

function compareEngineVersions(a, b) {
  const va = parseEngineVersion(a);
  const vb = parseEngineVersion(b);
  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  return va.patch - vb.patch;
}

module.exports = {
  GRADING_ENGINE_VERSION,
  getGradingEngineVersion,
  parseEngineVersion,
  compareEngineVersions,
};
