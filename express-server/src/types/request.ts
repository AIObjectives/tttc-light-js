import { Request } from "express";
import { Logger } from "pino";

/**
 * Extended Express Request interface that includes the pino-http logger
 */
export interface RequestWithLogger extends Request {
  log: Logger;
}
