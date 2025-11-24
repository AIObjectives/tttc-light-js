export function assertNever(x: never): never {
  throw new Error("Unexpected object: " + JSON.stringify(x));
}

/**
 * Firestore auto-generated IDs are exactly 20 characters long
 * and contain only alphanumeric characters
 */
export const FIRESTORE_ID_REGEX = /^[A-Za-z0-9]{20}$/;

/**
 * Validates that a report URI is safe for processing
 * Prevents malicious URLs like javascript:, data:, file:, etc.
 */
export function isValidReportUri(uri: string): boolean {
  if (!uri || typeof uri !== "string") {
    return false;
  }

  const trimmedUri = uri.trim();

  // Reject empty strings
  if (trimmedUri === "") {
    return false;
  }

  // Allow valid HTTPS URLs from trusted domains and legacy bucket-style paths
  try {
    // If it parses as URL, must be HTTPS and from trusted domains
    const url = new URL(trimmedUri);
    if (url.protocol !== "https:") {
      return false;
    }

    // Allow Google Cloud Storage URLs
    const trustedHosts = ["storage.googleapis.com", "storage.cloud.google.com"];
    return trustedHosts.includes(url.hostname);
  } catch {
    // If not a valid URL, treat as legacy bucket/path format
    // Allow alphanumeric, hyphens, underscores, dots, slashes
    return /^[a-zA-Z0-9._/-]+$/.test(trimmedUri);
  }
}

/**
 * Converts a GCS URL to legacy report URI format
 * @param gcsUrl - Full GCS URL like "https://storage.googleapis.com/bucket/path/file.json"
 * @returns Legacy URI format like "bucket/path/file.json"
 */
export function getLegacyReportUri(gcsUrl: string): string {
  try {
    const url = new URL(gcsUrl);
    if (url.hostname === "storage.googleapis.com") {
      // Remove leading slash and return bucket/path format
      return url.pathname.slice(1);
    }
    // If not a GCS URL, return as-is (might already be in legacy format)
    return gcsUrl;
  } catch {
    // If URL parsing fails, return as-is
    return gcsUrl;
  }
}

/**
 * Formats an error into a useful string message.
 * Handles Error objects, plain objects, and other types.
 * @param error - The error to format (can be any type)
 * @returns A formatted error message string
 */
export function formatError(error: unknown): string {
  // Handle Error instances
  if (error instanceof Error) {
    return error.message;
  }

  // Handle null or undefined
  if (error == null) {
    return "Unknown error";
  }

  // Handle objects with useful properties
  if (typeof error === "object") {
    // Try to extract common error properties
    const errorObj = error as Record<string, unknown>;

    // Check for common error properties in order of preference
    if (errorObj.message) {
      return String(errorObj.message);
    }
    if (errorObj.error) {
      return String(errorObj.error);
    }
    if (errorObj.code) {
      const code = String(errorObj.code);
      const msg = errorObj.msg || errorObj.description;
      return msg ? `${code}: ${String(msg)}` : code;
    }

    // Try to stringify the object for better debugging
    try {
      const jsonStr = JSON.stringify(error);
      if (jsonStr) {
        return jsonStr;
      }
    } catch {
      // JSON.stringify can fail on circular references
      return "Error object with circular reference";
    }
  }

  // Fallback to string conversion for primitives
  return String(error);
}
