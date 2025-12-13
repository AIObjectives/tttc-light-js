import type { EnvironmentInfo } from "./types";

/**
 * Environment detection utility that works in both browser and Node.js environments
 */

/**
 * Detects if we're running in a browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/**
 * Detects if we're running in a Node.js/server environment
 */
export function isServer(): boolean {
  return typeof process !== "undefined" && !!process.versions?.node;
}

export function isDevelopment(): boolean {
  if (isBrowser()) {
    return (
      window.location?.hostname === "localhost" ||
      window.location?.hostname === "127.0.0.1" ||
      window.location?.hostname?.endsWith(".local") ||
      window.location?.port === "3000" ||
      window.location?.port === "3001"
    );
  }

  if (isServer()) {
    return process.env?.NODE_ENV === "development";
  }

  return false;
}

/**
 * Gets the current URL (browser only)
 */
export function getCurrentUrl(): string | undefined {
  if (isBrowser()) {
    return window.location?.href;
  }
  return undefined;
}

/**
 * Gets the user agent (browser only)
 */
export function getUserAgent(): string | undefined {
  if (isBrowser()) {
    return navigator?.userAgent;
  }
  return undefined;
}

/**
 * Gets comprehensive environment information
 */
export function getEnvironmentInfo(): EnvironmentInfo {
  return {
    platform: isBrowser() ? "browser" : "server",
    isDevelopment: isDevelopment(),
    userAgent: getUserAgent(),
    url: getCurrentUrl(),
  };
}

/**
 * Creates a session ID for tracking
 * Uses globalThis.crypto.getRandomValues which works in both browser and Node.js 15+
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const array = new Uint8Array(8);
  globalThis.crypto.getRandomValues(array);
  const random = Array.from(array, (byte) => byte.toString(36)).join("");
  return `${timestamp}-${random}`;
}

/**
 * Creates a request ID for tracking
 * Uses globalThis.crypto.getRandomValues which works in both browser and Node.js 15+
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const array = new Uint8Array(8);
  globalThis.crypto.getRandomValues(array);
  const random = Array.from(array, (byte) => byte.toString(36)).join("");
  return `req-${timestamp}-${random}`;
}

/**
 * Gets the application version from environment or package
 */
export function getAppVersion(): string {
  if (isServer()) {
    return (
      process.env.APP_VERSION || process.env.npm_package_version || "1.0.0"
    );
  }

  // For browser, this would typically be set at build time
  return (globalThis as any).__APP_VERSION__ || "1.0.0";
}

/**
 * Gets the current environment name
 */
export function getEnvironmentName(): string {
  if (isServer()) {
    return process.env.NODE_ENV || "development";
  }

  if (isBrowser()) {
    const hostname = window.location?.hostname;
    if (!hostname) return "unknown";

    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".local")
    ) {
      return "development";
    }

    if (hostname.includes("staging") || hostname.includes("dev")) {
      return "staging";
    }

    return "production";
  }

  return "unknown";
}
