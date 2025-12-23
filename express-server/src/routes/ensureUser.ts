import type { Response } from "express";
import { ERROR_CODES } from "tttc-common/errors";
import * as firebase from "../Firebase";
import { createMondayItem } from "../services/monday";
import type { RequestWithAuth } from "../types/request";
import { sendErrorByCode } from "./sendError";

/**
 * Ensures a user document exists in Firestore and syncs new users to Monday.com
 *
 * Requires: authMiddleware()
 */
export default async function ensureUser(req: RequestWithAuth, res: Response) {
  req.log.info("Ensure user endpoint called");
  try {
    const decodedUser = req.auth;
    req.log.info({ uid: decodedUser.uid }, "Token verified");

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
