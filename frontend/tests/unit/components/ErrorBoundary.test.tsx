import { describe, it, expect, vi } from 'vitest';
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
