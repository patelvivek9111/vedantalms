const {
  normalizeLegacyUrl,
  isSkippableUploadsDir,
} = require('../../utils/fileBlobUtils');

describe('legacy file migration helpers', () => {
  test('normalizeLegacyUrl standardizes uploads paths', () => {
    expect(normalizeLegacyUrl('uploads/foo.pdf')).toBe('/uploads/foo.pdf');
    expect(normalizeLegacyUrl('/uploads/foo.pdf')).toBe('/uploads/foo.pdf');
    expect(normalizeLegacyUrl('https://cdn.example.com/uploads/x.pdf')).toBe('/uploads/x.pdf');
  });

  test('skips operational directories', () => {
    expect(isSkippableUploadsDir('exports/institution/batch')).toBe(true);
    expect(isSkippableUploadsDir('job-exports/file.xlsx')).toBe(true);
    expect(isSkippableUploadsDir('academic/course1/submission/x.pdf')).toBe(false);
    expect(isSkippableUploadsDir('public/profile/a.jpg')).toBe(true);
  });
});

describe('legacy registration idempotency key', () => {
  test('uses migrationMeta.legacyUrl as dedupe field in schema', () => {
    const schema = require('../../models/fileAsset.model').schema;
    const paths = schema.indexes().map((i) => i[0]);
    expect(paths.some((p) => p['migrationMeta.legacyUrl'])).toBe(true);
  });
});
