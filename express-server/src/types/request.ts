import { Request } from "express";
import { Logger } from "pino";
import { DecodedIdToken } from "firebase-admin/auth";

/**
 * Extended Express Request interface that includes the pino-http logger
 */
export interface RequestWithLogger extends Request {
  log: Logger;
}

/**
 * Extended Express Request interface that includes authentication context
 */
export interface RequestWithAuth extends RequestWithLogger {
  auth: DecodedIdToken;
}
