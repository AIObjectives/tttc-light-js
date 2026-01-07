/**
 * Browser/jsdom vitest setup for next-client.
 *
 * Extends base setup with browser-specific mocks:
 * - localStorage/sessionStorage
 * - window.matchMedia
 * - ResizeObserver
 * - IntersectionObserver
 *
 * Usage in vitest.config.ts:
 *   setupFiles: ['tttc-common/test-utils/setup/browser']
 *
 * Note: This file imports base setup, so you only need to include this one.
 */
import { vi } from "vitest";

// Import base setup first (order matters - sets up console interception)
import "./base";

// Re-export helpers from base for convenience
export { expectConsoleError, expectConsoleWarn } from "./base";

// Mock localStorage and sessionStorage
const createStorageMock = (): Storage => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
};

// Only set up browser mocks if we're in a browser-like environment
if (typeof window !== "undefined") {
  // Storage mocks
  Object.defineProperty(window, "localStorage", {
    value: createStorageMock(),
    writable: true,
  });
  Object.defineProperty(window, "sessionStorage", {
    value: createStorageMock(),
    writable: true,
  });

  // matchMedia mock (used by responsive components)
  Object.defineProperty(window, "matchMedia", {
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
  });

  // ResizeObserver mock (used by many UI libraries)
  class ResizeObserverMock {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: ResizeObserverMock,
  });

  // IntersectionObserver mock (used for lazy loading, infinite scroll)
  class IntersectionObserverMock {
    constructor(
      _callback: IntersectionObserverCallback,
      _options?: IntersectionObserverInit,
    ) {}
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    root = null;
    rootMargin = "";
    thresholds = [0];
    takeRecords = vi.fn().mockReturnValue([]);
  }
  Object.defineProperty(window, "IntersectionObserver", {
    writable: true,
    value: IntersectionObserverMock,
  });

  // scrollTo mock (prevents errors in tests)
  window.scrollTo = vi.fn();
}
