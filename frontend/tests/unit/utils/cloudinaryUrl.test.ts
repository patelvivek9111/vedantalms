import { describe, it, expect } from 'vitest';
import { optimizeCloudinaryUrl, isCloudinaryUrl } from '../../../src/utils/cloudinaryUrl';

describe('optimizeCloudinaryUrl (frontend)', () => {
  const sample =
    'https://res.cloudinary.com/dwvlv5wrv/image/upload/v1783186674/lms/academic/syllabus/file_b1fswl.png';

  it('inserts f_auto,q_auto into a plain Cloudinary image URL', () => {
    expect(optimizeCloudinaryUrl(sample)).toBe(
      'https://res.cloudinary.com/dwvlv5wrv/image/upload/f_auto,q_auto/v1783186674/lms/academic/syllabus/file_b1fswl.png'
    );
  });

  it('is idempotent when called twice', () => {
    const once = optimizeCloudinaryUrl(sample);
    expect(optimizeCloudinaryUrl(once)).toBe(once);
  });

  it('passes through non-Cloudinary and signed URLs unchanged', () => {
    expect(optimizeCloudinaryUrl('/uploads/a.png')).toBe('/uploads/a.png');
    const signed =
      'https://res.cloudinary.com/demo/image/upload/s--AbCdEfGh--/v1/lms/profile/avatar.png';
    expect(optimizeCloudinaryUrl(signed)).toBe(signed);
    expect(isCloudinaryUrl(sample)).toBe(true);
  });

  it('adds width for avatar-sized delivery', () => {
    expect(optimizeCloudinaryUrl(sample, { width: 80 })).toContain('w_80,c_limit');
  });
});
