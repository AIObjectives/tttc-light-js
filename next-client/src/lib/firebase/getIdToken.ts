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

// Primarily to avoid a security flag for using a hardcoded string in second field.
// The field is not used as a token without checking for validity first.
const GENERIC_ERROR_MESSAGE = "An error occurred";

export const fetchToken = async (
  user: User | null,
): Promise<["data", string | null] | ["error", string]> => {
  try {
    if (!user) return ["data", null];
    return ["data", await user?.getIdToken()];
  } catch (e) {
    return ["error", e instanceof Error ? e.message : GENERIC_ERROR_MESSAGE];
  }
};
