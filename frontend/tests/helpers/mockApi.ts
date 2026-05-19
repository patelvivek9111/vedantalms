import { vi } from 'vitest';

/** Axios-like instance for vi.mock('@/services/api', () => ({ default: createMockApi() })) */
export function createMockApi() {
  const interceptors = {
    request: { use: vi.fn(), eject: vi.fn() },
    response: { use: vi.fn(), eject: vi.fn() },
  };
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors,
    defaults: { headers: { common: {} } },
  };
}

export function createAxiosMock() {
  const instance = createMockApi();
  return {
    default: {
      create: vi.fn(() => instance),
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      interceptors: instance.interceptors,
    },
  };
}
