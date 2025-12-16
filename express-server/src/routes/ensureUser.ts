import { Response } from "express";
import { RequestWithLogger } from "../types/request";
import * as firebase from "../Firebase";
import { DecodedIdToken } from "firebase-admin/auth";
import { sendErrorByCode } from "./sendError";
import { ERROR_CODES } from "tttc-common/errors";
import { createMondayItem } from "../services/monday";

export default async function ensureUser(
  req: RequestWithLogger,
  res: Response,
) {
  req.log.info("Ensure user endpoint called");
  try {
    const firebaseAuthToken = req.body?.firebaseAuthToken;

    if (!firebaseAuthToken) {
      req.log.warn("No firebaseAuthToken provided");
      return sendErrorByCode(res, ERROR_CODES.AUTH_TOKEN_MISSING, req.log);
    }

    let decodedUser: DecodedIdToken;
    try {
      decodedUser = await firebase.verifyUser(firebaseAuthToken);
      req.log.info({ uid: decodedUser.uid }, "Token verified");
    } catch (tokenError) {
      req.log.error({ error: tokenError }, "Token verification failed");
      return sendErrorByCode(res, ERROR_CODES.AUTH_TOKEN_INVALID, req.log);
    }

    const { user: userDocument, isNew } = await firebase.ensureUserDocument(
      decodedUser.uid,
      decodedUser.email || null,
      decodedUser.name || null,
    );

    // Sync new users to Monday.com CRM
    if (isNew && decodedUser.email) {
      req.log.info(
        { uid: decodedUser.uid, email: decodedUser.email },
        "New user - syncing to Monday.com",
      );
      createMondayItem({
        displayName: decodedUser.name || decodedUser.email,
        email: decodedUser.email,
        // Newsletter opt-in is collected via ProfileSetupModal, not at signup
      }).catch((error) => {
        // monday.com sync failures are non-critical
        req.log.warn(
          { error, uid: decodedUser.uid },
          "monday.com sync failed for new user (non-blocking)",
        );
      });
    }

    req.log.info({ uid: decodedUser.uid, isNew }, "User document ensured");
    res.json({
      success: true,
      uid: decodedUser.uid,
      user: userDocument,
      isNew,
      message: "User document ensured successfully",
    });
  } catch (error) {
    req.log.error({ error }, "Error ensuring user");
    sendErrorByCode(res, ERROR_CODES.INTERNAL_ERROR, req.log);
  }
}
