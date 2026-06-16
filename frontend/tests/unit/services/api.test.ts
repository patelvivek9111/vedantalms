import { describe, expect, it } from 'vitest';
import { normalizeApiInstancePath } from '../../../src/services/api';

describe('normalizeApiInstancePath', () => {
  it('strips /api prefix when baseURL already ends with /api', () => {
    expect(normalizeApiInstancePath('/api/threads/abc/like', '/api')).toBe('/threads/abc/like');
  });

  it('leaves relative paths unchanged', () => {
    expect(normalizeApiInstancePath('/threads/abc/like', '/api')).toBe('/threads/abc/like');
  });

  it('leaves absolute URLs unchanged', () => {
    expect(
      normalizeApiInstancePath('http://localhost:5000/api/threads/abc/like', '/api'),
    ).toBe('http://localhost:5000/api/threads/abc/like');
  });
});
