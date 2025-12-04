import { Response } from "express";
import { Logger } from "pino";
import {
  ErrorCode,
  getErrorStatusCode,
  createErrorResponse,
} from "tttc-common/errors";

/**
 * Sends a consistent JSON error response.
 * @param res Express response object
 * @param status HTTP status code
 * @param message Error message
 * @param errorCode Optional error code
 * @param logger Optional logger for error tracking
 * @param requestId Optional request ID for log correlation
 * @deprecated Use sendErrorByCode() for new code to ensure consistent error messages
 */
export function sendError(
  res: Response,
  status: number,
  message: string,
  errorCode?: string,
  logger?: Logger,
  requestId?: string,
) {
  if (logger) {
    logger.warn(
      { status, message, errorCode, requestId },
      "Sending error response",
    );
  }

  res.status(status).json({
    error: {
      message,
      ...(errorCode ? { code: errorCode } : {}),
      ...(requestId ? { requestId } : {}),
    },
  });
}

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
