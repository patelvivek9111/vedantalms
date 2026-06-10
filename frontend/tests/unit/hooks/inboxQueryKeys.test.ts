import { describe, it, expect } from 'vitest';
import { inboxQueryKeys } from '@/hooks/inbox/inboxQueryKeys';

describe('inboxQueryKeys', () => {
  it('builds stable conversation keys per user', () => {
    expect(inboxQueryKeys.conversations('u1')).toEqual(['inbox', 'conversations', 'u1']);
  });

  it('builds message keys per conversation', () => {
    expect(inboxQueryKeys.messages('c1')).toEqual(['inbox', 'messages', 'c1']);
  });

  it('builds unread keys per user', () => {
    expect(inboxQueryKeys.unread('u1')).toEqual(['inbox', 'unread', 'u1']);
  });
});
