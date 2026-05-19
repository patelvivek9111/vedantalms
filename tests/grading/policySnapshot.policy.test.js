const {
  stableStringifyPolicy,
  hashResolvedPolicy,
  generateResolvedPolicySnapshot,
} = require('../../shared/grading/policySnapshot.cjs');
const { DEFAULT_GRADING_POLICY } = require('../../shared/grading/policyDefaults.cjs');

describe('policySnapshot', () => {
  it('produces stable hash regardless of key order', () => {
    const a = {
      latePenalty: { enabled: true, mode: 'per_day', perDayPercent: 5 },
      missingAssignment: { mode: 'count_as_zero' },
    };
    const b = {
      missingAssignment: { mode: 'count_as_zero' },
      latePenalty: { enabled: true, perDayPercent: 5, mode: 'per_day' },
    };
    expect(hashResolvedPolicy(a)).toBe(hashResolvedPolicy(b));
  });

  it('generateResolvedPolicySnapshot returns version, hash, and plain snapshot', () => {
    const resolved = {
      ...DEFAULT_GRADING_POLICY,
      groups: [{ name: 'Tests', weight: 100 }],
      _meta: { policyVersion: 3, courseId: 'abc' },
    };
    const bundle = generateResolvedPolicySnapshot(resolved);
    expect(bundle.policyVersion).toBe(3);
    expect(bundle.policyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(bundle.resolvedPolicySnapshot.groups).toEqual([{ name: 'Tests', weight: 100 }]);
    expect(typeof bundle.resolvedPolicySnapshot.latePenalty).toBe('object');
  });

  it('stableStringifyPolicy excludes volatile keys', () => {
    const withVolatile = { version: 1, updatedAt: '2025-01-01', missingAssignment: { mode: 'count_as_zero' } };
    const without = { version: 1, missingAssignment: { mode: 'count_as_zero' } };
    expect(stableStringifyPolicy(withVolatile)).toBe(stableStringifyPolicy(without));
  });
});
