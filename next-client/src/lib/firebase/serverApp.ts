/**
 * Firebase Server/Admin SDK Setup
 *
 * This file initializes the Firebase Admin SDK which runs on the server.
 * The server SDK is used for:
 * - Administrative operations with elevated privileges
 * - Bypassing client security rules when needed
 * - Server-side user verification and token validation
 * - Operations that require server-only secrets
 *
 * Key differences from client SDK:
 * - Runs in server environment with admin privileges
 * - Can bypass Firestore security rules
 * - Authenticates using service account credentials (not user tokens)
 * - Cannot run in browser (would expose admin credentials)
 * - Used for server-side API routes and server components
 *
 * IMPORTANT: Runtime Environment Variable Loading
 * This module uses functions instead of direct initialization because:
 * 1. Environment variables are loaded at runtime, not compile/build time
 * 2. Next.js build process may not have access to deployment environment variables
 * 3. Different environments (dev/staging/prod) need different Firebase configs
 * 4. Firebase Admin SDK requires credentials to be available before initialization
 *
 * This file is designed to work with lazy imports in API routes (see next-client/src/app/api/feedback/route.ts):
 * - API routes use `await import()` to load this module only when needed
 * - Ensures environment variables are fully loaded before Firebase initialization
 * - Prevents build-time errors when credentials aren't available
 * - Allows proper environment-specific configuration at runtime
 */

// enforces that this code can only be called on the server
// https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns#keeping-server-only-code-out-of-the-client-environment
import "server-only";

import { headers } from "next/headers";
import { getAuth } from "firebase-admin/auth";
import { getApps, initializeApp } from "firebase-admin/app";
import { firebaseConfig } from "./config";

/**
 * Get or create the Firebase Admin app instance.
 * Admin SDK has elevated privileges and bypasses client security rules.
 * Ensures only one app instance exists (singleton pattern).
 * Multiple instances can supposedly complicate state.
 */
function getFirebaseServerApp() {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

/**
 * Authenticate a user request on the server side.
 *
 * This function:
 * 1. Extracts the ID token from the Authorization header
 * 2. Verifies the token using the Admin SDK
 * 3. Returns the authenticated user info and admin app instance
 *
 * This is necessary because server-side code cannot access browser auth state.
 * The client must send the ID token in each request header.
 */
export async function getAuthenticatedAppForUser() {
  const authHeader = (await headers()).get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or malformed Authorization header");
  }
  const idToken = authHeader.split("Bearer ")[1];
  if (!idToken) {
    throw new Error("Missing ID token in Authorization header");
  }

  const auth = getAuth(getFirebaseServerApp());

  // Verify the token came from Firebase Auth and is valid
  const decodedToken = await auth.verifyIdToken(idToken).catch(() => {
    throw new Error("Invalid or expired ID token");
  });

  return {
    firebaseServerApp: getFirebaseServerApp(),
    auth,
    currentUser: decodedToken,
  };
}

/**
 * Get the Firebase Admin app for operations that don't require user authentication.
 * Used for public operations.
 */
export async function getUnauthenticatedApp() {
  return { firebaseServerApp: getFirebaseServerApp() };
}
