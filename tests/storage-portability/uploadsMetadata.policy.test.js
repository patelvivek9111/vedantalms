const { SECTION_DEFINITIONS } = require('../../shared/portability/sectionRegistry.cjs');

describe('portability — uploadsMetadata section', () => {
  test('uploadsMetadata exporter is defined and uses nested shape', () => {
    const def = SECTION_DEFINITIONS.uploadsMetadata;
    expect(def).toBeDefined();
    expect(typeof def.export).toBe('function');
  });

  test('fileAssets section registered for institution export', () => {
    expect(SECTION_DEFINITIONS.fileAssets).toBeDefined();
    expect(SECTION_DEFINITIONS.fileAssets.chunkable).toBe(true);
  });
});
