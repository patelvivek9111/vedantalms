import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Extend Vitest's expect with jest-dom matchers
// The import above automatically extends expect with jest-dom matchers

// Cleanup after each test
afterEach(() => {
  cleanup();
});

