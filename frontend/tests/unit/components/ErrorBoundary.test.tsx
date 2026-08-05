import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ErrorBoundary from '@/components/common/ErrorBoundary';

vi.mock('@/utils/logger', () => ({
  default: { error: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('§14 inventory test boom');
  }
  return <div>Child ok</div>;
}

describe('ErrorBoundary — §14.1 crash recovery', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Child ok')).toBeInTheDocument();
  });

  it('shows recovery UI and Try Again clears error state', () => {
    const throws = { value: true };
    function Boom() {
      if (throws.value) throw new Error('§14 inventory test boom');
      return <div>Child ok</div>;
    }
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    throws.value = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('Child ok')).toBeInTheDocument();
  });

  it('offers Go Home link to root', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/');
  });
});

describe('ErrorBoundary — technical detail exposure', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    window.localStorage.removeItem('lms:show-error-details');
  });

  it('shows the stack inline during development', () => {
    vi.stubEnv('DEV', true);
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Technical details')).toBeInTheDocument();
    expect(screen.getByText(/inventory test boom/)).toBeInTheDocument();
  });

  it('replaces the stack with a reference code in production', () => {
    vi.stubEnv('DEV', false);
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.queryByText('Technical details')).not.toBeInTheDocument();
    expect(screen.queryByText(/inventory test boom/)).not.toBeInTheDocument();
    expect(screen.getByText(/Reference code/)).toBeInTheDocument();
  });

  it('lets an engineer opt back into details in production via localStorage', () => {
    vi.stubEnv('DEV', false);
    window.localStorage.setItem('lms:show-error-details', '1');
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Technical details')).toBeInTheDocument();
    expect(screen.getByText(/inventory test boom/)).toBeInTheDocument();
  });
});
