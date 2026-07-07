import { beforeAll, afterAll, vi } from 'vitest';
import { POLICY_NOW } from '@tests/fixtures/grading/canvasParity.fixtures';

/** Align Vitest clock with backend canvasParity.fixtures.js (2025-06-15). */
export function useCanvasParityPolicyClock() {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    vi.useRealTimers();
  });
}
