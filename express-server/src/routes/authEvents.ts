import { Request, Response } from "express";
import { verifyUser } from "../Firebase";
import { DecodedIdToken } from "firebase-admin/auth";
import { sendError } from "./sendError";
import { z } from "zod";
import { logger } from "tttc-common/logger";

const authEventRequest = z.object({
  event: z.enum(["signin", "signout"]),
  firebaseAuthToken: z.string().optional(),
  clientTimestamp: z.string().optional(),
});

export default async function authEvents(req: Request, res: Response) {
  logger.info("EXPRESS AUTH EVENTS: Auth event endpoint called");
  try {
    const parsed = authEventRequest.safeParse(req.body);

    if (!parsed.success) {
      logger.warn("EXPRESS AUTH EVENTS: Invalid request format");
      return sendError(res, 400, "Invalid request format", "ValidationError");
    }

    const { event, firebaseAuthToken, clientTimestamp } = parsed.data;

    if (event === "signin" && firebaseAuthToken) {
      const decodedUser: DecodedIdToken = await verifyUser(firebaseAuthToken);

      logger.auth("signin", decodedUser.uid, decodedUser.email);

      res.json({
        success: true,
        message: "Sign in event logged",
        uid: decodedUser.uid,
      });
    } else if (event === "signout") {
      logger.auth("signout");

      res.json({
        success: true,
        message: "Sign out event logged",
      });
    } else {
      return sendError(
        res,
        400,
        "Invalid event or missing token",
        "ValidationError",
      );
    }
  } catch (error) {
    logger.error("EXPRESS AUTH EVENTS: Error logging auth event:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    sendError(res, 500, message, "AuthEventError");
  }
}
