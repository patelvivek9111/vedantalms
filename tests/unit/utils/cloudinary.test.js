const {
  extractPublicId,
  inferResourceTypeFromUrl,
  getSignedCloudinaryUrl,
} = require('../../../utils/cloudinary');

describe('cloudinary signed URLs', () => {
  const sampleUrl =
    'https://res.cloudinary.com/dwvlv5wrv/image/upload/v1783186674/lms/academic/syllabus/file_b1fswl.png';

  test('extractPublicId handles versioned paths without query string', () => {
    expect(extractPublicId(sampleUrl)).toBe('lms/academic/syllabus/file_b1fswl');
    expect(
      extractPublicId(
        'https://res.cloudinary.com/demo/auto/upload/s--sig--/fl_attachment/v1/lms/academic/syllabus/file_b1fswl?_a=x'
      )
    ).toBe('lms/academic/syllabus/file_b1fswl');
  });

  test('inferResourceTypeFromUrl reads delivery type from stored URL', () => {
    expect(inferResourceTypeFromUrl(sampleUrl)).toBe('image');
    expect(inferResourceTypeFromUrl('https://res.cloudinary.com/x/raw/upload/v1/lms/doc.pdf')).toBe(
      'raw'
    );
  });

  test('getSignedCloudinaryUrl uses image type instead of auto', () => {
    const signed = getSignedCloudinaryUrl(sampleUrl, { download: false, resourceType: 'auto' });
    expect(signed).toContain('/image/upload/');
    expect(signed).not.toContain('/auto/upload/');
  });
});
