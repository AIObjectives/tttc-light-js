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
const loggerConfig: any = {
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
};

if (isBrowser) {
  // Browser configuration - use console methods
  console.log("I should be getting here");
  loggerConfig.browser = {
    write: {
      debug: console.log,
      info: console.log,
      warn: console.warn,
      error: console.error,
    },
    serialize: false,
  };
} else if (isDevelopment && typeof require !== "undefined") {
  // Node.js development configuration - use pretty printing
  // Only use pino-pretty in pure Node.js environments (not webpack/bundled)
  try {
    loggerConfig.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    };
  } catch (e) {
    // Fallback to basic logging if pino-pretty is not available
    console.warn("pino-pretty not available, using basic logging");
  }
}

const logger = pino(loggerConfig);

export { logger };
