const {
  getGradingEngineVersion,
  compareEngineVersions,
  GRADING_ENGINE_VERSION,
} = require('../../shared/grading/gradingEngineVersion.cjs');

describe('gradingEngineVersion', () => {
  it('exports a semver string', () => {
    expect(getGradingEngineVersion()).toBe(GRADING_ENGINE_VERSION);
    expect(GRADING_ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('compares versions', () => {
    expect(compareEngineVersions('1.0.0', '1.0.1')).toBeLessThan(0);
    expect(compareEngineVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
  });
});
