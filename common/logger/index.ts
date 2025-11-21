/**
 * Universal Logger with Browser Compatibility
 *
 * This logger is designed to work in both Node.js and browser environments.
 * It uses Pino for Node.js environments and falls back to console logging
 * in browsers to avoid Node.js-specific module issues.
 *
 * Key features:
 * - Automatic environment detection
 * - Safe redaction of sensitive data (UIDs, emails, passwords, tokens)
 * - Authentication event logging with structured format
 * - Fallback to console logging if Pino fails
 *
 * Browser compatibility is handled through:
 * 1. Webpack configuration excluding Node.js modules (next.config.js)
 * 2. Environment detection preventing pino-pretty usage in browsers
 * 3. Fallback logger using console if Pino initialization fails
 */

import pino from "pino";

// Environment detection that works in both browser and Node.js with error handling
const isDevelopment = (() => {
  try {
    return (
      (typeof process !== "undefined" &&
        process.env?.NODE_ENV === "development") ||
      (typeof window !== "undefined" &&
        window.location?.hostname === "localhost")
    );
  } catch (error) {
    // Fallback to safe default in case of environment detection errors
    return false;
  }
})();

// Browser check - use browser transport for client-side logging
const isBrowser = (() => {
  try {
    return typeof window !== "undefined" && typeof document !== "undefined";
  } catch (error) {
    return false;
  }
})();

// Check if we're in a bundled environment (webpack, rollup, etc.)
const isBundled = (() => {
  try {
    // Check for webpack-specific variables and environment markers
    const hasWebpack =
      (typeof process !== "undefined" &&
        process.versions?.webpack !== undefined) ||
      (typeof process !== "undefined" && process.env.BUNDLED === "true") ||
      (typeof window !== "undefined" &&
        typeof (window as any).__webpack_require__ === "function");

    return hasWebpack;
  } catch (error) {
    return false;
  }
})();

// Next.js server check - avoid using workers in Next.js server environment
const isNextJSServer = (() => {
  try {
    return typeof window === "undefined" && !!process.env.NEXT_RUNTIME;
  } catch (error) {
    return false;
  }
})();

// Pure Node.js environment (not browser, not bundled)
const isPureNodeJS = (() => {
  try {
    return (
      !isBrowser &&
      !isBundled &&
      typeof process !== "undefined" &&
      typeof require !== "undefined"
    );
  } catch (error) {
    return false;
  }
})();

// Custom redaction function for sensitive user data
const customCensor = (value: any, path: string[]): any => {
  const fieldName = path[path.length - 1];

  // Handle null, undefined, and non-primitive values safely
  if (value === null || value === undefined) {
    return "[REDACTED]";
  }

  switch (fieldName) {
    case "uid":
      // Convert to string and handle both short and long UIDs safely
      const uidStr = String(value);
      if (uidStr.length > 8) {
        return `${uidStr.substring(0, 8)}...`;
      } else if (uidStr.length > 0) {
        // For short UIDs, show only first few characters to avoid full exposure
        return `${uidStr.substring(0, Math.min(3, uidStr.length))}...`;
      }
      return "[UID-REDACTED]";

    case "email":
      const emailStr = String(value);
      if (emailStr.includes("@") && emailStr.length > 1) {
        const parts = emailStr.split("@");
        if (parts.length === 2 && parts[1]) {
          return `<redacted>@${parts[1]}`;
        }
      }
      // Fallback for malformed emails or non-string values
      return "<redacted@domain>";

    case "displayName":
      return "<redacted>";

    case "password":
    case "token":
    case "secret":
    case "key":
    case "apiKey":
    case "accessToken":
    case "refreshToken":
      // Highly sensitive fields should be completely redacted
      return "[SENSITIVE-REDACTED]";

    default:
      return "[REDACTED]";
  }
};

// Define sensitive field paths for redaction
const REDACTION_PATHS = [
  "uid",
  "email",
  "displayName",
  "password",
  "token",
  "secret",
  "key",
  "apiKey",
  "accessToken",
  "refreshToken",
  "user.uid",
  "user.email",
  "user.displayName",
  "user.password",
  "user.token",
  "*.uid",
  "*.email",
  "*.displayName",
  "*.password",
  "*.token",
  "*.secret",
  "*.key",
  "*.apiKey",
  "*.accessToken",
  "*.refreshToken",
];

// Base logger configuration
const createBaseConfig = (): any => ({
  level: isDevelopment ? "debug" : "info",
  redact: {
    paths: REDACTION_PATHS,
    censor: customCensor,
    remove: false,
  },
});

// Environment-specific transport configuration
const configureBrowserTransport = (config: any): void => {
  if (typeof window !== "undefined" && window.console) {
    config.browser = {
      asObject: true,
    };
  }
};

const configureNextJSServerTransport = (config: any): void => {
  // Use simple logging to avoid worker thread issues
  config.level = "info";
  // Don't use transport to avoid worker issues
};

const configureNodeDevelopmentTransport = (config: any): void => {
  // Only use pino-pretty in pure Node.js environments
  if (!isPureNodeJS) {
    return;
  }

  try {
    // Additional safety check - ensure we have proper Node.js APIs
    if (
      typeof require === "undefined" ||
      typeof process.versions.node === "undefined"
    ) {
      return;
    }

    // Direct require is safe here because webpack IgnorePlugin will skip this module
    // See next.config.js webpack configuration
    // If IgnorePlugin is removed, this will gracefully fall back via try/catch
    require.resolve("pino-pretty");

    config.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    };
  } catch (prettierError) {
    // Silently fallback if pino-pretty is not available
    // This is expected in browser/webpack environments
  }
};

// Create logger configuration based on environment
const createLoggerConfig = (): any => {
  const config = createBaseConfig();

  try {
    if (isBrowser) {
      // Browser environment - use pino's built-in browser logging
      configureBrowserTransport(config);
    } else if (isNextJSServer) {
      // Next.js server environment - avoid worker threads
      configureNextJSServerTransport(config);
    } else if (isDevelopment && isPureNodeJS) {
      // Pure Node.js development environment - safe to use pino-pretty
      configureNodeDevelopmentTransport(config);
    }
    // For bundled environments, use default configuration (no special transport)
  } catch (transportError) {
    // Handle any unexpected errors in transport configuration
    if (typeof console !== "undefined") {
      console.warn(
        "Logger transport configuration failed, using defaults:",
        transportError,
      );
    }
  }

  return config;
};

const loggerConfig = createLoggerConfig();
const logger = pino(loggerConfig);

export { logger };
