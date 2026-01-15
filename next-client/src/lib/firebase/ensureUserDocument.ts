import type { User } from "firebase/auth";
import pRetry, { AbortError } from "p-retry";
import { logger } from "tttc-common/logger/browser";
import { fetchWithRequestId } from "../api/fetchWithRequestId";
import { type APIError, isAPIError } from "../types/api";
import { fetchToken } from "./getIdToken";

const ensureUserLogger = logger.child({ module: "ensure-user-client" });

const HTTP_UNAUTHORIZED = 401;
const HTTP_REQUEST_TIMEOUT = 408;
const HTTP_TOO_MANY_REQUESTS = 429;

import type { UserDocument } from "tttc-common/firebase";

/**
 * Ensures a user document exists in Firestore by calling the server API
 * This should be called immediately after a user signs in
 */

export type EnsureUserDocumentResult =
  | { tag: "success"; uid: string }
  | { tag: "failure"; error: unknown; retryable: boolean };

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
  const response = await fetchWithRequestId("/api/user/ensure", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(
      `API call failed with status ${response.status}`,
    ) as APIError;
    error.status = response.status;
    error.errorData = errorData;

    ensureUserLogger.error(
      {
        status: response.status,
        errorData,
      },
      "API call failed",
    );

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
  ensureUserLogger.info({ uid: user.uid }, "Ensuring user document");

  // Get token (with optional refresh)
  let token: string;
  if (forceTokenRefresh) {
    token = await user.getIdToken(true);
    ensureUserLogger.info({}, "Using refreshed token");
  } else {
    const tokenResult = await fetchToken(user);
    if (tokenResult.tag === "failure") {
      ensureUserLogger.error(
        { error: tokenResult.error },
        "Failed to get ID token",
      );
      throw new AbortError(
        tokenResult.error instanceof Error
          ? tokenResult.error
          : new Error(String(tokenResult.error)),
      );
    }
    if (!tokenResult.value) {
      const err = new Error("No authentication token available");
      ensureUserLogger.error({ error: err }, "No token available for user");
      throw new AbortError(err);
    }
    token = tokenResult.value;
  }

  try {
    const result = await callUserEnsureAPI(token);
    ensureUserLogger.info(
      { uid: result.uid },
      "User document ensured successfully",
    );
    return result;
  } catch (error: unknown) {
    // For HTTP_UNAUTHORIZED errors and not already using refreshed token, try once with refresh
    if (
      isAPIError(error) &&
      error.status === HTTP_UNAUTHORIZED &&
      !forceTokenRefresh
    ) {
      ensureUserLogger.info({}, "Token may be expired, retrying with refresh");
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
    const result = await pRetry(() => attemptEnsureUserDocument(user, false), {
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 10000,
      onFailedAttempt: (error) => {
        ensureUserLogger.warn(
          {
            attemptNumber: error.attemptNumber,
            uid: user.uid,
            retriesLeft: error.retriesLeft,
          },
          "Ensure user document attempt failed",
        );
      },
    });

    ensureUserLogger.info(
      { uid: result.uid },
      "User document ensured successfully",
    );

    if (!result.user) {
      ensureUserLogger.error(
        {},
        "No user document returned from ensure endpoint",
      );
      return {
        tag: "failure",
        error: "No user document returned",
        retryable: false,
      };
    }

    return { tag: "success", uid: result.uid };
  } catch (error) {
    const isAborted = error instanceof AbortError;
    ensureUserLogger.error(
      {
        uid: user.uid,
        error,
      },
      "Failed to ensure user document",
    );

    return {
      tag: "failure",
      error,
      retryable: !isAborted, // If aborted, it's not retryable
    };
  }
}
