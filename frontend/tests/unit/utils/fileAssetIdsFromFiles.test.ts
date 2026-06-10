import { describe, expect, it } from 'vitest';
import { fileAssetIdsFromFiles } from '@/utils/fileTypes';

describe('fileAssetIdsFromFiles', () => {
  it('returns only valid MongoDB object ids', () => {
    const ids = fileAssetIdsFromFiles([
      { fileAssetId: '507f1f77bcf86cd799439011', name: 'a.pdf', url: '/api/files/507f1f77bcf86cd799439011/download' },
      { name: 'no-id.pdf', url: '/uploads/x.pdf' },
      { fileAssetId: 'not-valid', name: 'bad', url: '' },
    ]);
    expect(ids).toEqual(['507f1f77bcf86cd799439011']);
  });
});
