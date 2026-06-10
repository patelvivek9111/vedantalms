import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useInboxUrlState } from '@/hooks/inbox/useInboxUrlState';

function wrapper(initial = '/inbox') {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  );
}

describe('useInboxUrlState', () => {
  it('defaults folder to inbox and omits empty params', () => {
    const { result } = renderHook(() => useInboxUrlState(), { wrapper: wrapper('/inbox') });
    expect(result.current.folder).toBe('inbox');
    expect(result.current.course).toBe('all');
    expect(result.current.conversationId).toBe('');
    expect(result.current.search).toBe('');
    expect(result.current.composeOpen).toBe(false);
  });

  it('reads folder and conversation from URL', () => {
    const { result } = renderHook(() => useInboxUrlState(), {
      wrapper: wrapper('/inbox?folder=sent&c=abc123&q=hello'),
    });
    expect(result.current.folder).toBe('sent');
    expect(result.current.conversationId).toBe('abc123');
    expect(result.current.search).toBe('hello');
  });

  it('patchUrl updates conversation id', () => {
    const { result } = renderHook(() => useInboxUrlState(), { wrapper: wrapper('/inbox') });
    act(() => {
      result.current.setConversationId('conv-1');
    });
    expect(result.current.conversationId).toBe('conv-1');
  });
});
