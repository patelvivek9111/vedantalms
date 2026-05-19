import { describe, expect, it } from 'vitest';
import {
  hashResolvedPolicy,
  generateResolvedPolicySnapshot,
} from '../../../../shared/grading/policySnapshot.mjs';
import { diffPolicies, DEFAULT_GRADING_POLICY } from '../gradeUtils';

describe('policy snapshot (frontend shared)', () => {
  it('hash is stable across key order', () => {
    const h1 = hashResolvedPolicy({
      a: 1,
      b: { c: 2, d: 3 },
    });
    const h2 = hashResolvedPolicy({
      b: { d: 3, c: 2 },
      a: 1,
    });
    expect(h1).toBe(h2);
  });

  it('diffPolicies detects changes', () => {
    const diff = diffPolicies(
      { latePenalty: { perDayPercent: 5 } },
      { latePenalty: { perDayPercent: 10 } }
    );
    expect(diff.changed.some((c) => c.path.includes('perDayPercent'))).toBe(true);
  });

  it('generateResolvedPolicySnapshot includes version and hash', () => {
    const bundle = generateResolvedPolicySnapshot({
      ...DEFAULT_GRADING_POLICY,
      _meta: { policyVersion: 2 },
    });
    expect(bundle.policyVersion).toBe(2);
    expect(bundle.policyHash).toHaveLength(64);
  });
});
