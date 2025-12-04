/**
 * Shared error codes and user-friendly messages for the Talk to the City API.
 *
 * These codes are used by both the Express server (for consistent error responses)
 * and the Next.js client (for displaying appropriate error messages).
 */

/**
 * Standard error codes used across the application.
 * Each code maps to an HTTP status category and a user-friendly message.
 */
export const ERROR_CODES = {
  // Authentication errors (401/403)
  AUTH_TOKEN_MISSING: "AUTH_TOKEN_MISSING",
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_EMAIL_NOT_VERIFIED: "AUTH_EMAIL_NOT_VERIFIED",
  AUTH_UNAUTHORIZED: "AUTH_UNAUTHORIZED",

  // Validation errors (400)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_REQUEST: "INVALID_REQUEST",
  CSV_TOO_LARGE: "CSV_TOO_LARGE",
  CSV_INVALID_FORMAT: "CSV_INVALID_FORMAT",
  CSV_SECURITY_VIOLATION: "CSV_SECURITY_VIOLATION",
  INVALID_REPORT_URI: "INVALID_REPORT_URI",

  // Resource errors (404)
  REPORT_NOT_FOUND: "REPORT_NOT_FOUND",
  USER_NOT_FOUND: "USER_NOT_FOUND",

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // Server errors (500)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  PIPELINE_FAILED: "PIPELINE_FAILED",
  STORAGE_ERROR: "STORAGE_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  DATABASE_ERROR: "DATABASE_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * User-friendly error messages for each error code.
 * These messages are safe to display to end users and don't expose internal details.
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // Authentication
  [ERROR_CODES.AUTH_TOKEN_MISSING]: "Please sign in to continue.",
  [ERROR_CODES.AUTH_TOKEN_INVALID]:
    "Your session is invalid. Please sign in again.",
  [ERROR_CODES.AUTH_TOKEN_EXPIRED]:
    "Your session has expired. Please sign in again.",
  [ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED]:
    "Please verify your email address to continue. Check your inbox for a verification link.",
  [ERROR_CODES.AUTH_UNAUTHORIZED]:
    "You don't have permission to perform this action.",

  // Validation
  [ERROR_CODES.VALIDATION_ERROR]:
    "The request contains invalid data. Please check your input.",
  [ERROR_CODES.INVALID_REQUEST]: "The request format is invalid.",
  [ERROR_CODES.CSV_TOO_LARGE]:
    "The file is too large. Please upload a smaller file.",
  [ERROR_CODES.CSV_INVALID_FORMAT]:
    "The file format isn't recognized. Please ensure it's a valid CSV file.",
  [ERROR_CODES.CSV_SECURITY_VIOLATION]:
    "The file contains content that can't be processed. Please check the file and try again.",
  [ERROR_CODES.INVALID_REPORT_URI]: "The report address is invalid.",

  // Resources
  [ERROR_CODES.REPORT_NOT_FOUND]:
    "We couldn't find that report. It may have been deleted or moved.",
  [ERROR_CODES.USER_NOT_FOUND]: "User account not found.",

  // Rate limiting
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]:
    "You're making requests too quickly. Please wait a moment and try again.",

  // Server
  [ERROR_CODES.INTERNAL_ERROR]:
    "Something went wrong on our end. Please try again.",
  [ERROR_CODES.PIPELINE_FAILED]:
    "Report generation failed. Please try again or contact support if the problem persists.",
  [ERROR_CODES.STORAGE_ERROR]: "Unable to access the report. Please try again.",
  [ERROR_CODES.SERVICE_UNAVAILABLE]:
    "Our service is temporarily unavailable. Please try again in a few minutes.",
  [ERROR_CODES.DATABASE_ERROR]:
    "Unable to access the database. Please try again.",
};

/**
 * HTTP status codes associated with each error code.
 */
export const ERROR_STATUS_CODES: Record<ErrorCode, number> = {
  // Authentication - 401/403
  [ERROR_CODES.AUTH_TOKEN_MISSING]: 401,
  [ERROR_CODES.AUTH_TOKEN_INVALID]: 401,
  [ERROR_CODES.AUTH_TOKEN_EXPIRED]: 401,
  [ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED]: 403,
  [ERROR_CODES.AUTH_UNAUTHORIZED]: 403,

  // Validation - 400
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.INVALID_REQUEST]: 400,
  [ERROR_CODES.CSV_TOO_LARGE]: 400,
  [ERROR_CODES.CSV_INVALID_FORMAT]: 400,
  [ERROR_CODES.CSV_SECURITY_VIOLATION]: 400,
  [ERROR_CODES.INVALID_REPORT_URI]: 400,

  // Resources - 404
  [ERROR_CODES.REPORT_NOT_FOUND]: 404,
  [ERROR_CODES.USER_NOT_FOUND]: 404,

  // Rate limiting - 429
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 429,

  // Server - 500
  [ERROR_CODES.INTERNAL_ERROR]: 500,
  [ERROR_CODES.PIPELINE_FAILED]: 500,
  [ERROR_CODES.STORAGE_ERROR]: 500,
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 503,
  [ERROR_CODES.DATABASE_ERROR]: 500,
};

/**
 * Get the user-friendly message for an error code.
 * Falls back to a generic message if the code is unknown.
 */
export function getErrorMessage(code: string): string {
  return (
    ERROR_MESSAGES[code as ErrorCode] ??
    "Something went wrong. Please try again."
  );
}

/**
 * Get the HTTP status code for an error code.
 * Falls back to 500 if the code is unknown.
 */
export function getErrorStatusCode(code: string): number {
  return ERROR_STATUS_CODES[code as ErrorCode] ?? 500;
}

/**
 * Standard API error response structure.
 */
export interface ApiErrorResponse {
  error: {
    message: string;
    code: ErrorCode;
    requestId?: string;
  };
}

/**
 * Create a standardized error response object.
 */
export function createErrorResponse(
  code: ErrorCode,
  requestId?: string,
  customMessage?: string,
): ApiErrorResponse {
  return {
    error: {
      message: customMessage ?? ERROR_MESSAGES[code],
      code,
      ...(requestId ? { requestId } : {}),
    },
  };
}
