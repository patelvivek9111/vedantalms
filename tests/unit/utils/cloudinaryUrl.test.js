const { optimizeCloudinaryUrl, isCloudinaryUrl } = require('../../../utils/cloudinaryUrl');

describe('optimizeCloudinaryUrl', () => {
  const sample =
    'https://res.cloudinary.com/dwvlv5wrv/image/upload/v1783186674/lms/academic/syllabus/file_b1fswl.png';

  test('inserts f_auto,q_auto into a plain Cloudinary image URL', () => {
    expect(optimizeCloudinaryUrl(sample)).toBe(
      'https://res.cloudinary.com/dwvlv5wrv/image/upload/f_auto,q_auto/v1783186674/lms/academic/syllabus/file_b1fswl.png'
    );
  });

  test('is idempotent when called twice', () => {
    const once = optimizeCloudinaryUrl(sample);
    const twice = optimizeCloudinaryUrl(once);
    expect(twice).toBe(once);
    expect(twice).toBe(
      'https://res.cloudinary.com/dwvlv5wrv/image/upload/f_auto,q_auto/v1783186674/lms/academic/syllabus/file_b1fswl.png'
    );
  });

  test('prepends to existing transforms without duplicating f_auto/q_auto', () => {
    const withCrop =
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_200/v1/lms/branding/logo.png';
    expect(optimizeCloudinaryUrl(withCrop)).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,w_200/v1/lms/branding/logo.png'
    );
  });

  test('adds optional width + c_limit for thumbnails', () => {
    expect(optimizeCloudinaryUrl(sample, { width: 80 })).toBe(
      'https://res.cloudinary.com/dwvlv5wrv/image/upload/f_auto,q_auto,w_80,c_limit/v1783186674/lms/academic/syllabus/file_b1fswl.png'
    );
  });

  test('passes through non-Cloudinary URLs unchanged', () => {
    expect(optimizeCloudinaryUrl('/uploads/avatar.png')).toBe('/uploads/avatar.png');
    expect(optimizeCloudinaryUrl('https://cdn.example.com/a.png')).toBe(
      'https://cdn.example.com/a.png'
    );
    expect(optimizeCloudinaryUrl('')).toBe('');
    expect(isCloudinaryUrl(sample)).toBe(true);
    expect(isCloudinaryUrl('/uploads/x.png')).toBe(false);
  });

  test('does not mutate signed Cloudinary URLs', () => {
    const signed =
      'https://res.cloudinary.com/demo/image/upload/s--AbCdEfGh--/v1/lms/profile/avatar.png';
    expect(optimizeCloudinaryUrl(signed)).toBe(signed);
  });

  test('leaves raw delivery alone (PDFs / non-image)', () => {
    const raw =
      'https://res.cloudinary.com/demo/raw/upload/v1/lms/uploads/doc.pdf';
    expect(optimizeCloudinaryUrl(raw)).toBe(raw);
  });

  test('preserves query strings', () => {
    expect(optimizeCloudinaryUrl(`${sample}?_a=1`)).toBe(
      'https://res.cloudinary.com/dwvlv5wrv/image/upload/f_auto,q_auto/v1783186674/lms/academic/syllabus/file_b1fswl.png?_a=1'
    );
  });
});
