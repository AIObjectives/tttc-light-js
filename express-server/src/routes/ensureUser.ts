import { Request, Response } from "express";
import * as firebase from "../Firebase";
import { DecodedIdToken } from "firebase-admin/auth";
import { sendError } from "./sendError";
import { logger } from "tttc-common/logger";

export default async function ensureUser(req: Request, res: Response) {
  logger.info("EXPRESS ENSURE USER: Ensure user endpoint called");
  try {
    const { firebaseAuthToken } = req.body;

    if (!firebaseAuthToken) {
      logger.warn("EXPRESS ENSURE USER: No firebaseAuthToken provided");
      return sendError(res, 400, "Missing firebaseAuthToken", "AuthError");
    }

    let decodedUser: DecodedIdToken;
    try {
      decodedUser = await firebase.verifyUser(firebaseAuthToken);
      logger.info(
        `EXPRESS ENSURE USER: Token verified for UID: ${decodedUser.uid}`,
      );
    } catch (tokenError) {
      logger.error(
        "EXPRESS ENSURE USER: Token verification failed:",
        tokenError,
      );
      return sendError(res, 401, "Invalid or expired token", "TokenError");
    }

    const userDocument = await firebase.ensureUserDocument(
      decodedUser.uid,
      decodedUser.email || null,
      decodedUser.name || null,
    );

    logger.info(
      `EXPRESS ENSURE USER: User document ensured for UID: ${decodedUser.uid}`,
    );
    res.json({
      success: true,
      uid: decodedUser.uid,
      user: userDocument,
      message: "User document ensured successfully",
    });
  } catch (error) {
    logger.error("EXPRESS ENSURE USER: Error ensuring user:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    sendError(res, 500, message, "EnsureUserError");
  }
}
