import pino from "pino";

// Environment detection that works in both browser and Node.js
const isDevelopment =
  (typeof process !== "undefined" && process.env?.NODE_ENV === "development") ||
  (typeof window !== "undefined" && window.location?.hostname === "localhost");

// Browser check - use browser transport for client-side logging
const isBrowser = typeof window !== "undefined";

// Custom redaction function for sensitive user data
const customCensor = (value: any, path: string[]): any => {
  const fieldName = path[path.length - 1];

  switch (fieldName) {
    case "uid":
      return typeof value === "string" && value.length > 8
        ? `${value.substring(0, 8)}...`
        : `${value}...`;
    case "email":
      if (typeof value === "string" && value.includes("@")) {
        const domain = value.split("@")[1];
        return `<redacted>@${domain}`;
      }
      return value;
    case "displayName":
      return "<redacted>";
    default:
      return "[REDACTED]";
  }
};

// Configure pino logger based on environment
const logger = pino({
  level: isDevelopment ? "debug" : "info",
  redact: {
    paths: [
      "uid",
      "email",
      "displayName",
      "user.uid",
      "user.email",
      "user.displayName",
      "*.uid",
      "*.email",
      "*.displayName",
    ],
    censor: customCensor,
    remove: false,
  },
  browser: isBrowser
    ? {
        // In browser, use console methods
        write: {
          debug: console.log,
          info: console.log,
          warn: console.warn,
          error: console.error,
        },
        serialize: false,
      }
    : undefined,
  // For Node.js environments, use pretty printing in development
  transport:
    !isBrowser && isDevelopment
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        }
      : undefined,
});

export { logger };
