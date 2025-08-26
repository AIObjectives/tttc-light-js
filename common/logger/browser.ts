// Browser-specific logger that avoids Node.js modules entirely

// Create a browser-compatible logger
const createBrowserLogger = () => {
  const log = (level: string, data: any, message?: string) => {
    const timestamp = new Date().toISOString();

    let logData = data;

    // Use appropriate console method
    const consoleFn = (console as any)[level] || console.log;
    if (message) {
      consoleFn(`[${timestamp}] ${level.toUpperCase()}: ${message}`, logData);
    } else {
      consoleFn(`[${timestamp}] ${level.toUpperCase()}:`, logData);
    }
  };

  const browserLogger = {
    debug: (data: any, message?: string) => log("debug", data, message),
    info: (data: any, message?: string) => log("info", data, message),
    warn: (data: any, message?: string) => log("warn", data, message),
    error: (data: any, message?: string) => log("error", data, message),
    child: (bindings: any) => {
      // Return a logger that includes the binding data in all logs
      return {
        debug: (data: any, message?: string) =>
          log("debug", { ...bindings, ...data }, message),
        info: (data: any, message?: string) =>
          log("info", { ...bindings, ...data }, message),
        warn: (data: any, message?: string) =>
          log("warn", { ...bindings, ...data }, message),
        error: (data: any, message?: string) =>
          log("error", { ...bindings, ...data }, message),
        child: browserLogger.child,
        auth: browserLogger.auth,
      };
    },
    auth: (
      action: string,
      uid?: string | null,
      email?: string | null,
      additionalData?: Record<string, any>,
    ) => {
      const timestamp = new Date().toISOString();
      const domain = email ? email.split("@")[1] : "unknown";

      const authData = {
        authAction: action,
        uid: uid || "anonymous",
        email: email || "no-email",
        domain,
        timestamp,
        ...additionalData,
      };

      log("info", authData, `🔐 [AUTH] ${action.toUpperCase()}`);
    },
  };

  return browserLogger;
};

export const logger = createBrowserLogger();
export default logger;
