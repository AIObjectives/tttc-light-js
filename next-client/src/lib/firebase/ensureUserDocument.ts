import { User } from "firebase/auth";
import { fetchToken } from "./getIdToken";
import { logger } from "tttc-common/logger";

/**
 * Ensures a user document exists in Firestore by calling the server API
 * This should be called immediately after a user signs in
 */

export type EnsureUserDocumentResult =
  | { tag: "success"; uid: string }
  | { tag: "failure"; error: unknown };

export async function ensureUserDocumentOnClient(
  user: User,
): Promise<EnsureUserDocumentResult> {
  logger.info("CLIENT: Ensuring user document for UID:", user.uid);

  try {
    const tokenResult = await fetchToken(user);

    if (tokenResult.tag === "failure") {
      logger.error("CLIENT: Failed to get ID token:", tokenResult.error);
      return { tag: "failure", error: tokenResult.error };
    }

    const token = tokenResult.value;
    if (!token) {
      const err = new Error("No authentication token available");
      logger.error("CLIENT: No token available for user");
      return { tag: "failure", error: err };
    }

    logger.debug("CLIENT: Calling /api/user/ensure");
    const response = await fetch("/api/user/ensure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error("CLIENT: API call failed:", {
        status: response.status,
        errorData,
      });
      return { tag: "failure", error: { status: response.status, errorData } };
    }

    const result = await response.json();
    logger.info(
      "CLIENT: User document ensured successfully for UID:",
      result.uid,
    );
    return { tag: "success", uid: result.uid };
  } catch (error) {
    logger.error("CLIENT: Failed to ensure user document:", error);
    // Optionally report the error to an error tracking service later
    // Don't throw - we don't want to break the authentication flow if user document creation fails
    return { tag: "failure", error };
  }
}
