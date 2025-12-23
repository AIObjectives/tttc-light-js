/**
 * Tests for environment detection utilities
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateRequestId,
  generateSessionId,
  getAppVersion,
  getCurrentUrl,
  getEnvironmentInfo,
  getEnvironmentName,
  getUserAgent,
  isBrowser,
  isDevelopment,
  isServer,
} from "../environment";

// Mock global objects
const mockWindow = {
  location: {
    hostname: "localhost",
    href: "http://localhost:3000/test",
    port: "3000",
  },
};

const mockNavigator = {
  userAgent: "Mozilla/5.0 (Test Browser)",
};

const mockProcess = {
  versions: { node: "18.0.0" },
  env: {
    NODE_ENV: "test",
    APP_VERSION: "1.2.3",
    npm_package_version: "1.0.0",
  },
};

describe("Environment Detection", () => {
  // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
  let originalWindow: any;
  // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
  let originalProcess: any;
  // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
  let originalNavigator: any;

  beforeEach(() => {
    // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
    originalWindow = (globalThis as any).window;
    // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
    originalProcess = (globalThis as any).process;
    // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
    originalNavigator = (globalThis as any).navigator;

    // Clear all mocks
    // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
    delete (globalThis as any).window;
    // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
    delete (globalThis as any).process;
    // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
    delete (globalThis as any).navigator;
  });

  afterEach(() => {
    // Restore original globals
    if (originalWindow !== undefined) {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).window = originalWindow;
    }
    if (originalProcess !== undefined) {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).process = originalProcess;
    }
    if (originalNavigator !== undefined) {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).navigator = originalNavigator;
    }
  });

  describe("isBrowser", () => {
    it("should return true when window and document are available", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).window = mockWindow;
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).document = {};

      expect(isBrowser()).toBe(true);
    });

    it("should return false when window is not available", () => {
      expect(isBrowser()).toBe(false);
    });

    it("should return false when document is not available", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).window = mockWindow;
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      delete (globalThis as any).document;

      expect(isBrowser()).toBe(false);
    });
  });

  describe("isServer", () => {
    it("should return true when process.versions.node is available", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).process = mockProcess;

      expect(isServer()).toBeTruthy();
    });

    it("should return false when process is not available", () => {
      expect(isServer()).toBeFalsy();
    });

    it("should return false when process.versions.node is not available", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).process = { versions: {} };

      expect(isServer()).toBeFalsy();
    });
  });

  describe("isDevelopment", () => {
    it("should return true for localhost in browser", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).window = mockWindow;
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).document = {};

      expect(isDevelopment()).toBe(true);
    });

    it("should return true for 127.0.0.1 in browser", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).window = {
        location: { hostname: "127.0.0.1" },
      };
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).document = {};

      expect(isDevelopment()).toBe(true);
    });

    it("should return true for .local domains in browser", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).window = {
        location: { hostname: "app.local" },
      };
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).document = {};

      expect(isDevelopment()).toBe(true);
    });

    it("should return true for port 3000 in browser", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).window = {
        location: { hostname: "example.com", port: "3000" },
      };
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).document = {};

      expect(isDevelopment()).toBe(true);
    });

    it("should return false for production domains in browser", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).window = {
        location: { hostname: "example.com", port: "443" },
      };
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).document = {};

      expect(isDevelopment()).toBe(false);
    });

    it("should return true for NODE_ENV=development on server", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).process = {
        versions: { node: "18.0.0" },
        env: { NODE_ENV: "development" },
      };

      expect(isDevelopment()).toBe(true);
    });

    it("should return false for NODE_ENV=production on server", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).process = {
        versions: { node: "18.0.0" },
        env: { NODE_ENV: "production" },
      };

      expect(isDevelopment()).toBe(false);
    });
  });

  describe("getCurrentUrl", () => {
    it("should return current URL in browser", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).window = mockWindow;

      expect(getCurrentUrl()).toBe("http://localhost:3000/test");
    });

    it("should return undefined on server", () => {
      expect(getCurrentUrl()).toBeUndefined();
    });
  });

  describe("getUserAgent", () => {
    it("should return user agent in browser", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).window = mockWindow;
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).document = {};
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).navigator = mockNavigator;

      expect(getUserAgent()).toBe("Mozilla/5.0 (Test Browser)");
    });

    it("should return undefined on server", () => {
      expect(getUserAgent()).toBeUndefined();
    });
  });

  describe("getEnvironmentInfo", () => {
    it("should return browser environment info", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).window = mockWindow;
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).document = {};
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).navigator = mockNavigator;

      const info = getEnvironmentInfo();

      expect(info.platform).toBe("browser");
      expect(info.isDevelopment).toBe(true);
      expect(info.userAgent).toBe("Mozilla/5.0 (Test Browser)");
      expect(info.url).toBe("http://localhost:3000/test");
    });

    it("should return server environment info", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).process = mockProcess;

      const info = getEnvironmentInfo();

      expect(info.platform).toBe("server");
      expect(info.isDevelopment).toBe(false); // NODE_ENV is 'test'
      expect(info.userAgent).toBeUndefined();
      expect(info.url).toBeUndefined();
    });
  });

  describe("generateSessionId", () => {
    it("should generate a valid session ID", () => {
      const sessionId = generateSessionId();

      expect(typeof sessionId).toBe("string");
      expect(sessionId).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
      expect(sessionId.length).toBeGreaterThan(10);
    });

    it("should generate unique session IDs", () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();

      expect(id1).not.toBe(id2);
    });
  });

  describe("generateRequestId", () => {
    it("should generate a valid request ID", () => {
      const requestId = generateRequestId();

      expect(typeof requestId).toBe("string");
      expect(requestId).toMatch(/^req-[a-z0-9]+-[a-z0-9]+$/);
      expect(requestId.length).toBeGreaterThan(15);
    });

    it("should generate unique request IDs", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();

      expect(id1).not.toBe(id2);
    });
  });

  describe("getAppVersion", () => {
    it("should return APP_VERSION from process.env on server", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).process = mockProcess;

      expect(getAppVersion()).toBe("1.2.3");
    });

    it("should return npm_package_version if APP_VERSION not available", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).process = {
        versions: { node: "18.0.0" },
        env: { npm_package_version: "1.0.0" },
      };

      expect(getAppVersion()).toBe("1.0.0");
    });

    it("should return default version if no version available", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).process = {
        versions: { node: "18.0.0" },
        env: {},
      };

      expect(getAppVersion()).toBe("1.0.0");
    });

    it("should return global __APP_VERSION__ in browser", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).__APP_VERSION__ = "2.0.0";

      expect(getAppVersion()).toBe("2.0.0");

      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      delete (globalThis as any).__APP_VERSION__;
    });

    it("should return default version in browser without global", () => {
      expect(getAppVersion()).toBe("1.0.0");
    });
  });

  describe("getEnvironmentName", () => {
    it("should return NODE_ENV from process.env on server", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).process = mockProcess;

      expect(getEnvironmentName()).toBe("test");
    });

    it("should return development for localhost in browser", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).window = mockWindow;

      expect(getEnvironmentName()).toBe("development");
    });

    it("should return staging for staging domains in browser", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).window = {
        location: { hostname: "staging.example.com" },
      };

      expect(getEnvironmentName()).toBe("staging");
    });

    it("should return production for production domains in browser", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test utilities need to manipulate global objects
      (globalThis as any).window = {
        location: { hostname: "example.com" },
      };

      expect(getEnvironmentName()).toBe("production");
    });

    it("should return unknown when no environment can be determined", () => {
      expect(getEnvironmentName()).toBe("unknown");
    });
  });
});
