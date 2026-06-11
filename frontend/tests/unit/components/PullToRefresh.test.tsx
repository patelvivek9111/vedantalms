import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PullToRefresh from '@/components/common/PullToRefresh';
import {
  getEffectiveScrollTop,
  isAtScrollTop,
  isElementScrollable,
} from '@/utils/scrollPosition';

describe('scrollPosition utils', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    Object.defineProperty(container, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 500, configurable: true });
    Object.defineProperty(container, 'scrollTop', { value: 120, configurable: true, writable: true });
    Object.defineProperty(window, 'scrollY', { value: 400, configurable: true, writable: true });
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ overflowY: 'auto' } as CSSStyleDeclaration);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects scrollable elements', () => {
    expect(isElementScrollable(container)).toBe(true);
  });

  it('uses container scrollTop when the container is scrollable', () => {
    expect(getEffectiveScrollTop(container)).toBe(120);
  });

  it('uses window scrollY when the container does not scroll', () => {
    Object.defineProperty(container, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 500, configurable: true });
    Object.defineProperty(container, 'scrollTop', { value: 0, configurable: true, writable: true });

    expect(getEffectiveScrollTop(container)).toBe(400);
  });

  it('returns false for isAtScrollTop when the window is scrolled', () => {
    expect(isAtScrollTop(container)).toBe(false);
  });

  it('returns true for isAtScrollTop when window and nested containers are at the top', () => {
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
    Object.defineProperty(container, 'scrollTop', { value: 0, configurable: true, writable: true });

    expect(isAtScrollTop(container)).toBe(true);
  });

  it('returns false for isAtScrollTop when a nested scroll container is scrolled', () => {
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });

    const nested = document.createElement('div');
    Object.defineProperty(nested, 'scrollHeight', { value: 800, configurable: true });
    Object.defineProperty(nested, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(nested, 'scrollTop', { value: 50, configurable: true, writable: true });
    container.appendChild(nested);

    expect(isAtScrollTop(nested)).toBe(false);
  });
});

describe('PullToRefresh', () => {
  it('renders children', () => {
    render(
      <PullToRefresh onRefresh={vi.fn()}>
        <div>Dashboard content</div>
      </PullToRefresh>
    );

    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });
});
