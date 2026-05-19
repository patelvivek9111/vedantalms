const { diffPolicies } = require('../../shared/grading/policyDiff.cjs');

describe('policyDiff', () => {
  it('detects nested field changes', () => {
    const oldPolicy = { latePenalty: { enabled: true, perDayPercent: 5 } };
    const newPolicy = { latePenalty: { enabled: true, perDayPercent: 10 } };
    const diff = diffPolicies(oldPolicy, newPolicy);
    expect(diff.changed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'latePenalty.perDayPercent',
          before: 5,
          after: 10,
        }),
      ])
    );
  });

  it('reports added and removed top-level keys', () => {
    const diff = diffPolicies({ a: 1 }, { b: 2 });
    expect(diff.added).toContain('b');
    expect(diff.removed).toContain('a');
  });
});
