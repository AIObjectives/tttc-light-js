import type { Request } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { Logger } from "pino";

/**
 * Header name for request correlation ID.
 * Using X-Request-ID to align with pino-http convention.
 */
export const REQUEST_ID_HEADER = "X-Request-ID";

/**
 * Extended Express Request interface that includes the pino-http logger.
 *
 * Note: pino-http also adds a request ID as `req.id`, but we can't declare it
 * here because it conflicts with Express's Request.id method signature.
 * Access it via getRequestId() helper when needed.
 */
export interface RequestWithLogger extends Request {
  log: Logger;
}

/**
 * Get the request correlation ID.
 *
 * Priority order:
 * 1. X-Request-ID header from client (for end-to-end tracing)
 * 2. pino-http's req.id (fallback for requests without header)
 *
 * Returns undefined if neither is available.
 */
export function getRequestId(req: Request): string | undefined {
  // First, check for X-Request-ID header from client
  const headerValue = req.headers[REQUEST_ID_HEADER.toLowerCase()];
  if (typeof headerValue === "string" && headerValue.length > 0) {
    return headerValue;
  }

  // Fall back to pino-http's request ID
  return (req as unknown as { id?: string }).id;
}

/**
 * Extended Express Request interface that includes authentication context
 */
export interface RequestWithAuth extends RequestWithLogger {
  auth: DecodedIdToken;
}
