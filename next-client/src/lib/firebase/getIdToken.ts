/**
 * ID Token Utilities
 *
 * Helper functions for working with Firebase ID tokens.
 * ID tokens are JWTs that prove a user's identity and are used to
 * authenticate server-side requests.
 *
 * Flow:
 * 1. User signs in via client SDK
 * 2. Client gets ID token from Firebase Auth
 * 3. Client sends token in Authorization header to server
 * 4. Server verifies token using Admin SDK
 */

import { User } from "firebase/auth";
import { Result, success, failure } from "tttc-common/functional-utils";

export async function fetchToken(
  user: User | null,
): Promise<Result<string | null, Error>> {
  try {
    if (!user) {
      return success(null);
    }

    const token = await user.getIdToken();
    return success(token);
  } catch (error) {
    console.error("Failed to get ID token:", error);
    const err =
      error instanceof Error ? error : new Error("Failed to get token");
    return failure(err);
  }
}
