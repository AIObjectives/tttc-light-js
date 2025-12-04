import { Request } from "express";
import { Logger } from "pino";
import { DecodedIdToken } from "firebase-admin/auth";

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
 * Get the pino-http request ID from a request.
 * Returns undefined if pino-http middleware hasn't run.
 */
export function getRequestId(req: Request): string | undefined {
  // pino-http adds id as a string property
  return (req as unknown as { id?: string }).id;
}

/**
 * Extended Express Request interface that includes authentication context
 */
export interface RequestWithAuth extends RequestWithLogger {
  auth: DecodedIdToken;
}
