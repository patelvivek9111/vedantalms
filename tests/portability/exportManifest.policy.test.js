const {
  buildExportManifest,
  validateExportManifest,
} = require('../../shared/portability/exportManifest.cjs');

describe('export manifest (Phase P3)', () => {
  test('build + validate roundtrip', () => {
    const manifest = buildExportManifest({
      institutionId: 'default',
      sections: [{ name: 'courses', file: 'courses.json', recordCount: 1 }],
    });
    const result = validateExportManifest(manifest);
    expect(result.valid).toBe(true);
    expect(manifest.checksum).toHaveLength(64);
  });

  test('rejects tampered checksum', () => {
    const manifest = buildExportManifest({ sections: [] });
    manifest.checksum = 'bad';
    expect(validateExportManifest(manifest).valid).toBe(false);
  });
});
