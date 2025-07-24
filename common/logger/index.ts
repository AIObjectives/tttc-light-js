/**
 * Secure logging utility that respects environment and privacy
 * Works in both browser and Node.js environments
 */

type LogLevel = "debug" | "info" | "warn" | "error";

// Environment detection that works in both browser and Node.js
const isDevelopment =
  (typeof process !== "undefined" && process.env?.NODE_ENV === "development") ||
  (typeof window !== "undefined" && window.location?.hostname === "localhost");

class SecureLogger {
  constructor(private prefix = "[UserAccount]") {}

  private shouldLog(level: LogLevel): boolean {
    if (!isDevelopment && level === "debug") return false;
    return true;
  }

  private sanitizeUser(
    uid?: string,
    email?: string | null,
    displayName?: string | null,
  ): string {
    if (!uid && !email) return "anonymous";

    const shortUid = uid ? uid.substring(0, 8) + "..." : "unknown";
    const domain = email ? email.split("@")[1] : "unknown";
    const hasDisplayName = displayName ? "yes" : "no";

    return `uid=${shortUid} domain=${domain} displayName=${hasDisplayName}`;
  }

  private formatUserData(userData?: any, isDebugLevel?: boolean): string {
    if (!userData) return "";

    if (typeof userData === "string") {
      return ` - uid=${userData.substring(0, 8)}...`;
    }

    const uid = userData.uid || userData.firebaseUid;
    const email = userData.email;
    const displayName = userData.displayName || userData.name;

    if (uid && email && isDebugLevel) {
      // For debug level: simplified format without displayName
      const shortUid = uid.substring(0, 8) + "...";
      const domain = email.split("@")[1];
      return ` - uid=${shortUid} domain=${domain}`;
    } else if (uid) {
      return ` - ${this.sanitizeUser(uid, email, displayName)}`;
    } else if (email) {
      return ` - ${this.sanitizeUser(undefined, email, displayName)}`;
    }

    return "";
  }

  private logMessage(level: LogLevel, message: string, userData?: any): void {
    if (!this.shouldLog(level)) return;

    const userInfo = this.formatUserData(userData, level === "debug");
    const fullMessage = `${this.prefix} ${message}${userInfo}`;

    console.log(fullMessage);
  }

  /**
   * Logs a debug message with optional user data.
   * @param message The message to log.
   * @param userData User object or uid string.
   */
  debug(message: string, userData?: any): void {
    this.logMessage("debug", message, userData);
  }

  /**
   * Logs an info message with optional user data.
   * @param message The message to log.
   * @param userData User object or uid string.
   */
  info(message: string, userData?: any): void {
    this.logMessage("info", message, userData);
  }

  /**
   * Logs a warning message with optional error details.
   * @param message The warning message to log.
   * @param error Optional error object or details.
   */
  warn(message: string, error?: any) {
    if (!this.shouldLog("warn")) return;
    console.warn(`${this.prefix} ${message}`, error);
  }

  /**
   * Logs an error message with optional error details.
   * @param message The error message to log.
   * @param error Optional error object or details.
   */
  error(message: string, error?: any) {
    if (!this.shouldLog("error")) return;

    if (error === null) {
      console.log(`${this.prefix} ${message} - null`);
    } else if (error) {
      console.error(`${this.prefix} ${message}`, error);
    } else {
      console.error(`${this.prefix} ${message}`);
    }
  }

  /**
   * Structured authentication logs for monitoring authentication events.
   * @param event - The authentication event type ("signin", "signout", or "verify").
   * @param uid - The user's unique identifier (optional, required for "signin" and "verify").
   * @param email - The user's email address (optional).
   */
  auth(
    event: "signin" | "signout" | "verify",
    uid?: string,
    email?: string | null,
  ) {
    const timestamp = new Date().toISOString();

    if (event === "signin" && uid) {
      const domain = email ? email.split("@")[1] : "unknown";
      console.log(
        `🔐 [AUTH] USER_SIGNIN uid=${uid} domain=${domain} time=${timestamp}`,
      );
    } else if (event === "signout") {
      console.log(`🔓 [AUTH] USER_SIGNOUT time=${timestamp}`);
    } else if (event === "verify" && uid) {
      console.log(`🔑 [AUTH] TOKEN_VERIFIED uid=${uid} time=${timestamp}`);
    }
  }
}

export const logger = new SecureLogger();
