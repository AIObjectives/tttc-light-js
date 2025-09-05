import { Response } from "express";
import { RequestWithLogger } from "../types/request";
import * as firebase from "../Firebase";
import { logger } from "tttc-common/logger";
import { getUserCapabilities } from "tttc-common/permissions";
import { isFeatureEnabled } from "../featureFlags";
import { sendError } from "./sendError";
import * as api from "tttc-common/api";

const userLogger = logger.child({ module: "user" });

/**
 * Get the current user's capabilities and limits
 * Returns the user's CSV size limit based on their roles
 */
export async function getUserLimits(
  req: RequestWithLogger,
  res: Response,
): Promise<void> {
  try {
    // Get authorization token from header
    const authToken = req.headers.authorization?.replace("Bearer ", "");

    if (!authToken) {
      sendError(res, 401, "No authorization token provided");
      return;
    }

    // Verify the user's token
    const decodedUser = await firebase.verifyUser(authToken);

    if (!decodedUser) {
      sendError(res, 401, "Invalid authorization token");
      return;
    }

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

    // Check feature flag for large uploads
    const largeUploadsEnabled = await isFeatureEnabled(
      "large_uploads_enabled",
      { userId: decodedUser.uid },
    );

    // Get user capabilities based on roles and feature flags
    const capabilities = getUserCapabilities(roles, largeUploadsEnabled);

    // Validate response schema
    const validatedResponse = api.userCapabilitiesResponse.parse(capabilities);

    userLogger.info(
      { uid: decodedUser.uid, roles, largeUploadsEnabled, capabilities },
      "User limits retrieved",
    );

    res.json(validatedResponse);
  } catch (error) {
    userLogger.error({ error }, "Failed to get user limits");
    sendError(res, 500, "Failed to retrieve user limits");
  }
}
