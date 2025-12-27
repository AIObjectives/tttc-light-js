import type { Response } from "express";
import type { Logger } from "pino";
import {
  createErrorResponse,
  type ErrorCode,
  getErrorStatusCode,
} from "tttc-common/errors";

/**
 * Sends an error response using standardized error codes.
 * Automatically uses the correct HTTP status code and user-friendly message.
 * @param res Express response object
 * @param code Standardized error code from ERROR_CODES
 * @param logger Optional logger for error tracking
 * @param requestId Optional request ID for log correlation
 */
export function sendErrorByCode(
  res: Response,
  code: ErrorCode,
  logger?: Logger,
  requestId?: string,
) {
  const status = getErrorStatusCode(code);
  const errorResponse = createErrorResponse(code, requestId);

  if (logger) {
    // Use error level for 500s, warn for client errors
    if (status >= 500) {
      logger.error({ status, code, requestId }, "Sending error response");
    } else {
      logger.warn({ status, code, requestId }, "Sending error response");
    }
  }

  res.status(status).json(errorResponse);
}
