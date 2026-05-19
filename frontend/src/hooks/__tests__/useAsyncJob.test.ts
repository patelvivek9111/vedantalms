import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAsyncJob } from '../useAsyncJob';

vi.mock('../../services/jobsApi', () => ({
  fetchJobStatus: vi.fn(),
  openJobDownload: vi.fn(),
}));

import { fetchJobStatus } from '../../services/jobsApi';

describe('useAsyncJob', () => {
  beforeEach(() => {
    vi.mocked(fetchJobStatus).mockReset();
  });

  it('stops polling when job completes', async () => {
    vi.mocked(fetchJobStatus)
      .mockResolvedValueOnce({
        success: true,
        data: { id: 'j1', type: 'export.gradebook', status: 'active', progress: { completed: 1, total: 2 } },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { id: 'j1', type: 'export.gradebook', status: 'completed', hasDownload: true },
      });

    vi.useFakeTimers();
    const { result } = renderHook(() => useAsyncJob());

    await act(async () => {
      await result.current.pollJob('j1');
    });

    expect(result.current.polling).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    expect(result.current.job?.status).toBe('completed');
    expect(result.current.polling).toBe(false);
    vi.useRealTimers();
  });
});
