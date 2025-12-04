import { Response } from "express";
import { RequestWithLogger } from "../types/request";
import * as firebase from "../Firebase";
import { logger } from "tttc-common/logger";
import { getUserCapabilities } from "tttc-common/permissions";
import { sendErrorByCode } from "./sendError";
import { ERROR_CODES } from "tttc-common/errors";
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
      sendErrorByCode(res, ERROR_CODES.AUTH_TOKEN_MISSING, userLogger);
      return;
    }

    // Verify the user's token
    const decodedUser = await firebase.verifyUser(authToken);

    if (!decodedUser) {
      sendErrorByCode(res, ERROR_CODES.AUTH_TOKEN_INVALID, userLogger);
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
