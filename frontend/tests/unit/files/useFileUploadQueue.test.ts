import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFileUploadQueue } from '../../../src/hooks/useFileUploadQueue';

vi.mock('../../../src/services/fileUploadApi', () => ({
  uploadFiles: vi.fn(async (files: File[]) =>
    files.map((f, i) => ({
      fileAssetId: `asset-${i}`,
      name: f.name,
      url: `/api/files/507f1f77bcf86cd79943901${i}/download`,
      size: f.size,
      status: 'done',
    }))
  ),
}));

describe('useFileUploadQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues and completes uploads', async () => {
    const { result } = renderHook(() => useFileUploadQueue({ concurrency: 1 }));
    const file = new File(['x'], 'test.txt', { type: 'text/plain' });

    act(() => {
      result.current.enqueue([file]);
    });

    await waitFor(() => {
      expect(result.current.completedFiles.length).toBe(1);
    });
    expect(result.current.completedFiles[0].name).toBe('test.txt');
  });

  it('cancels an in-flight upload', async () => {
    const { uploadFiles } = await import('../../../src/services/fileUploadApi');
    vi.mocked(uploadFiles).mockImplementation(
      () =>
        new Promise(() => {
          /* never resolves */
        }) as ReturnType<typeof uploadFiles>
    );

    const { result } = renderHook(() => useFileUploadQueue());
    const file = new File(['x'], 'slow.bin');

    act(() => {
      result.current.enqueue([file]);
    });

    await waitFor(() => expect(result.current.items[0]?.status).toBe('uploading'));

    act(() => {
      result.current.cancel(result.current.items[0].id);
    });

    expect(result.current.items[0]?.status).toBe('cancelled');
  });
});
