import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ContactInquiryModal } from '@/components/modals/ContactInquiryModal';

describe('ContactInquiryModal timeouts', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            const signal = init?.signal;
            if (!signal) return;
            if (signal.aborted) {
              reject(new DOMException('Aborted', 'AbortError'));
              return;
            }
            signal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          })
      )
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('aborts around 40s and shows an error instead of hanging on Sending…', async () => {
    render(<ContactInquiryModal open onOpenChange={() => {}} />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Vivek' } });
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'v@example.com' } });
    fireEvent.change(screen.getByLabelText(/job title/i), { target: { value: 'Admin' } });
    fireEvent.change(screen.getByLabelText(/school \/ college name/i), {
      target: { value: 'MySl8te' },
    });
    fireEvent.change(screen.getByLabelText(/how many users/i), { target: { value: '100' } });

    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(40_000);
    });

    await waitFor(() => {
      expect(
        screen.getByRole('alert')
      ).toHaveTextContent(/something went wrong|info@mysl8te\.com/i);
    });
    expect(screen.getByRole('button', { name: /^send$/i })).not.toBeDisabled();
    expect(screen.queryByRole('button', { name: /sending/i })).not.toBeInTheDocument();
  });
});
