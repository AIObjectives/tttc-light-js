import type { Response } from "express";
import * as api from "tttc-common/api";
import { ERROR_CODES } from "tttc-common/errors";
import { logger } from "tttc-common/logger";
import { getUserCapabilities } from "tttc-common/permissions";
import * as firebase from "../Firebase";
import type { RequestWithAuth } from "../types/request";
import { sendErrorByCode } from "./sendError";

const userLogger = logger.child({ module: "user" });

/**
 * Get the current user's capabilities and limits
 * Returns the user's CSV size limit based on their roles
 *
 * Requires: authMiddleware({ tokenLocation: "header" })
 */
export async function getUserLimits(
  req: RequestWithAuth,
  res: Response,
): Promise<void> {
  try {
    const decodedUser = req.auth;

    // Get user document to fetch roles
    const userRef = firebase.db
      .collection(firebase.getCollectionName("USERS"))
      .doc(decodedUser.uid);
    const userDoc = await userRef.get();

    let roles: string[] = [];
    if (userDoc.exists) {
      const userData = userDoc.data();
      roles = userData?.roles || [];
    }

    // Get user capabilities based on roles
    const capabilities = getUserCapabilities(roles);

    // Validate response schema
    const validatedResponse = api.userCapabilitiesResponse.parse(capabilities);

    userLogger.info(
      { uid: decodedUser.uid, roles, capabilities },
      "User limits retrieved",
    );

    res.json(validatedResponse);
  } catch (error) {
    userLogger.error({ error }, "Failed to get user limits");
    sendErrorByCode(res, ERROR_CODES.INTERNAL_ERROR, userLogger);
  }
}
