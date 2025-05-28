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
 */

import "server-only";
import { headers } from "next/headers";
import { getAuth } from "firebase-admin/auth";
import { getApps, initializeApp } from "firebase-admin/app";

function getFirebaseServerApp() {
  if (getApps().length === 0) {
    return initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
  return getApps()[0];
}

export async function getAuthenticatedAppForUser() {
  const headersList = await headers();
  const authorization = headersList.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return { firebaseServerApp: getFirebaseServerApp(), currentUser: null };
  }

  const idToken = authorization.split("Bearer ")[1];
  const auth = getAuth(getFirebaseServerApp());

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    const currentUser = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      displayName: decodedToken.name || null,
    };
    return { firebaseServerApp: getFirebaseServerApp(), currentUser };
  } catch (error) {
    return { firebaseServerApp: getFirebaseServerApp(), currentUser: null };
  }
}

export async function getUnauthenticatedApp() {
  return { firebaseServerApp: getFirebaseServerApp() };
}
