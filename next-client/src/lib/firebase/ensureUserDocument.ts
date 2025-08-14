import { User } from "firebase/auth";
import { fetchToken } from "./getIdToken";
import { logger } from "tttc-common/logger";
import pRetry, { AbortError } from "p-retry";
import { APIError, isAPIError } from "../types/api";

const HTTP_UNAUTHORIZED = 401;
const HTTP_REQUEST_TIMEOUT = 408;
const HTTP_TOO_MANY_REQUESTS = 429;
import { signOut } from "./auth";
import { UserDocument } from "tttc-common/firebase";

/**
 * Ensures a user document exists in Firestore by calling the server API
 * This should be called immediately after a user signs in
 */

export type EnsureUserDocumentResult =
  | { tag: "success"; uid: string }
  | { tag: "failure"; error: unknown; retryable: boolean }
  | { tag: "waitlisted"; uid: string };

function shouldAbortRetry(error: unknown): boolean {
  if (isAPIError(error)) {
    const status = error.status;
    return (
      status >= 400 &&
      status < 500 &&
      status !== HTTP_REQUEST_TIMEOUT &&
      status !== HTTP_TOO_MANY_REQUESTS
    );
  }
  return false;
}

async function callUserEnsureAPI(token: string): Promise<{
  uid: string;
  success: boolean;
  user: UserDocument;
  message: string;
}> {
  const response = await fetch("/api/user/ensure", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(
      `API call failed with status ${response.status}`,
    ) as APIError;
    error.status = response.status;
    error.errorData = errorData;

    logger.error("CLIENT: API call failed:", {
      status: response.status,
      errorData,
    });

    throw error;
  }

  return response.json();
}

async function attemptEnsureUserDocument(
  user: User,
  forceTokenRefresh = false,
): Promise<{
  uid: string;
  success: boolean;
  user: UserDocument;
  message: string;
}> {
  logger.info(`CLIENT: Ensuring user document for UID: ${user.uid}`);

  // Get token (with optional refresh)
  let token: string;
  if (forceTokenRefresh) {
    token = await user.getIdToken(true);
    logger.info("CLIENT: Using refreshed token");
  } else {
    const tokenResult = await fetchToken(user);
    if (tokenResult.tag === "failure") {
      logger.error("CLIENT: Failed to get ID token:", tokenResult.error);
      throw new AbortError(
        tokenResult.error instanceof Error
          ? tokenResult.error
          : new Error(String(tokenResult.error)),
      );
    }
    if (!tokenResult.value) {
      const err = new Error("No authentication token available");
      logger.error("CLIENT: No token available for user");
      throw new AbortError(err);
    }
    token = tokenResult.value;
  }

  try {
    const result = await callUserEnsureAPI(token);
    logger.info(
      `CLIENT: User document ensured successfully for UID: ${result.uid}`,
    );
    return result;
  } catch (error: unknown) {
    // For HTTP_UNAUTHORIZED errors and not already using refreshed token, try once with refresh
    if (
      isAPIError(error) &&
      error.status === HTTP_UNAUTHORIZED &&
      !forceTokenRefresh
    ) {
      logger.info("CLIENT: Token may be expired, retrying with refresh");
      return attemptEnsureUserDocument(user, true);
    }

    if (shouldAbortRetry(error)) {
      throw new AbortError(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
    throw error;
  }
}

export async function ensureUserDocumentOnClient(
  user: User,
): Promise<EnsureUserDocumentResult> {
  try {
    const result = await pRetry(() => attemptEnsureUserDocument(user), {
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 10000,
      onFailedAttempt: (error) => {
        logger.warn(
          `CLIENT: Attempt ${error.attemptNumber} failed for user ${user.uid}. ${error.retriesLeft} retries left.`,
        );
      },
    });

    logger.info(
      "CLIENT: User document ensured successfully for UID:",
      result.uid,
    );

    // Check waitlist status from the returned user document
    if (!result.user) {
      logger.error("CLIENT: No user document returned from ensure endpoint");
      return {
        tag: "failure",
        error: "No user document returned",
        retryable: false,
      };
    }

    const userDoc = result.user;
    logger.debug("CLIENT: Checking waitlist status for user", {
      isWaitlistApproved: userDoc.isWaitlistApproved,
    });

    if (!userDoc.isWaitlistApproved) {
      logger.info("CLIENT: User is not waitlist approved, signing out");
      await signOut();
      return { tag: "waitlisted", uid: result.uid };
    }

    return { tag: "success", uid: result.uid };
  } catch (error) {
    const isAborted = error instanceof AbortError;
    logger.error(
      `CLIENT: Failed to ensure user document for ${user.uid}:`,
      error,
    );

    return {
      tag: "failure",
      error,
      retryable: !isAborted, // If aborted, it's not retryable
    };
  }
}
