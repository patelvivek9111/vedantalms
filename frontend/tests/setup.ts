import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { createAxiosMock } from './helpers/mockApi'
import { setMemoryAuthToken } from '@/utils/authToken'

// Bridge legacy test pattern: localStorage token -> in-memory auth token
const origSetItem = localStorage.setItem.bind(localStorage)
localStorage.setItem = (key: string, value: string) => {
  origSetItem(key, value)
  if (key === 'token') setMemoryAuthToken(value)
}
const origRemoveItem = localStorage.removeItem.bind(localStorage)
localStorage.removeItem = (key: string) => {
  origRemoveItem(key)
  if (key === 'token') setMemoryAuthToken(null)
}

afterEach(() => {
  setMemoryAuthToken(null)
  localStorage.removeItem('token')
})

// Default axios mock so modules that call axios.create() (e.g. api.ts) do not crash when loaded.
vi.mock('axios', () => createAxiosMock())

// jsdom does not implement matchMedia (used by GlobalSidebar, RichTextEditor, etc.)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

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


