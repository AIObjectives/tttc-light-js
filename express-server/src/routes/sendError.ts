import { Response } from "express";

/**
 * Sends a consistent JSON error response.
 */
export function sendError(
  res: Response,
  status: number,
  message: string,
  errorCode?: string,
) {
  res.status(status).json({
    error: {
      message,
      ...(errorCode ? { code: errorCode } : {}),
    },
  });
}
