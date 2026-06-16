import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import NetworkOfflineBanner from '@/design-system/NetworkOfflineBanner';

function OfflineBannerHarness() {
  const { offline } = useNetworkStatus();
  return (
    <>
      {offline ? <NetworkOfflineBanner /> : <p>Network online</p>}
    </>
  );
}

describe('useNetworkStatus + NetworkOfflineBanner', () => {
  afterEach(() => {
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
  });

  it('shows offline banner when browser fires offline event', () => {
    render(<OfflineBannerHarness />);
    expect(screen.getByText('Network online')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      'You appear to be offline. Changes may not save until your connection returns.'
    );
    expect(screen.queryByText('Network online')).not.toBeInTheDocument();
  });

  it('hides offline banner when browser comes back online', () => {
    render(<OfflineBannerHarness />);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByText('Network online')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
