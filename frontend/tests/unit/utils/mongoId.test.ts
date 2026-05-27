import { describe, expect, it } from 'vitest';
import { normalizeMongoIdRef } from '@/utils/mongoId';

describe('normalizeMongoIdRef', () => {
  it('normalizes string, ObjectId-like object, and populated course', () => {
    expect(normalizeMongoIdRef('507f1f77bcf86cd799439011')).toBe('507f1f77bcf86cd799439011');
    expect(normalizeMongoIdRef({ _id: 'abc123' })).toBe('abc123');
    expect(normalizeMongoIdRef({ $oid: 'deadbeefdeadbeefdeadbeef' })).toBe('deadbeefdeadbeefdeadbeef');
  });

  it('returns empty for nullish', () => {
    expect(normalizeMongoIdRef(null)).toBe('');
    expect(normalizeMongoIdRef(undefined)).toBe('');
  });
});
