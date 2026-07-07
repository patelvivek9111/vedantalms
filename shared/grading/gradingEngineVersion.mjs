export const GRADING_ENGINE_VERSION = '1.3.0';

export function getGradingEngineVersion() {
  return GRADING_ENGINE_VERSION;
}

export function parseEngineVersion(version) {
  const parts = String(version || '')
    .split('.')
    .map((n) => parseInt(n, 10));
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
}

export function compareEngineVersions(a, b) {
  const va = parseEngineVersion(a);
  const vb = parseEngineVersion(b);
  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  return va.patch - vb.patch;
}
