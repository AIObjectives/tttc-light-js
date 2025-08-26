import { Response } from "express";
import { Logger } from "pino";

/**
 * Sends a consistent JSON error response.
 * @param res Express response object
 * @param status HTTP status code
 * @param message Error message
 * @param errorCode Optional error code
 * @param logger Optional logger for error tracking
 */
export function sendError(
  res: Response,
  status: number,
  message: string,
  errorCode?: string,
  logger?: Logger,
) {
  if (logger) {
    logger.warn({ status, message, errorCode }, "Sending error response");
  }

  res.status(status).json({
    error: {
      message,
      ...(errorCode ? { code: errorCode } : {}),
    },
  });
}
