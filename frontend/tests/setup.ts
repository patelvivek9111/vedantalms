import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
import { createAxiosMock } from './helpers/mockApi'

// Default axios mock so modules that call axios.create() (e.g. api.ts) do not crash when loaded.
vi.mock('axios', () => createAxiosMock())

const suppressedWarningPatterns = [
  'React Router Future Flag Warning',
  'Warning: An update to',
  'When testing, code that causes React state updates should be wrapped into act',
  "This ensures that you're testing the behavior the user would see in the browser",
];

const shouldSuppressWarning = (args: unknown[]): boolean => {
  const firstArg = args[0];
  if (typeof firstArg === 'string') {
    return suppressedWarningPatterns.some((pattern) => firstArg.includes(pattern));
  }
  if (firstArg instanceof Error) {
    return firstArg.message === 'Test error';
  }
  return false;
};

const originalConsoleWarn = console.warn.bind(console);
const originalConsoleError = console.error.bind(console);

console.warn = (...args: unknown[]) => {
  if (shouldSuppressWarning(args)) return;
  originalConsoleWarn(...args);
};

console.error = (...args: unknown[]) => {
  if (shouldSuppressWarning(args)) return;
  originalConsoleError(...args);
};


