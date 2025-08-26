import { Response } from "express";
import { Logger } from "pino";
import { RequestWithLogger } from "../types/request";
import * as firebase from "../Firebase";
import { DecodedIdToken } from "firebase-admin/auth";
import { sendError } from "./sendError";

export default async function ensureUser(
  req: RequestWithLogger,
  res: Response,
) {
  req.log.info("Ensure user endpoint called");
  try {
    const { firebaseAuthToken } = req.body;

    if (!firebaseAuthToken) {
      req.log.warn("No firebaseAuthToken provided");
      return sendError(res, 400, "Missing firebaseAuthToken", "AuthError");
    }

    let decodedUser: DecodedIdToken;
    try {
      decodedUser = await firebase.verifyUser(firebaseAuthToken);
      req.log.info({ uid: decodedUser.uid }, "Token verified");
    } catch (tokenError) {
      req.log.error({ error: tokenError }, "Token verification failed");
      return sendError(res, 401, "Invalid or expired token", "TokenError");
    }

    const userDocument = await firebase.ensureUserDocument(
      decodedUser.uid,
      decodedUser.email || null,
      decodedUser.name || null,
    );

    req.log.info({ uid: decodedUser.uid }, "User document ensured");
    res.json({
      success: true,
      uid: decodedUser.uid,
      user: userDocument,
      message: "User document ensured successfully",
    });
  } catch (error) {
    req.log.error({ error }, "Error ensuring user");
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    sendError(res, 500, message, "EnsureUserError");
  }
}
