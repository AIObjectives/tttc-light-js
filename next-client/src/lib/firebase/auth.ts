/**
 * Firebase Authentication (Client SDK)
 *
 * Handles user authentication in the browser using Firebase Auth.
 * This runs on the client side and manages user sign-in/sign-out flows.
 *
 * The client SDK authentication:
 * - Provides UI-based auth flows (Google redirect, email/password)
 * - Manages auth state in the browser
 * - Generates ID tokens that can be sent to server
 * - Handles token refresh automatically
 */

"use client";

import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User,
  type UserCredential,
} from "firebase/auth";
import { getFirebaseAuth } from "./clientApp";

export function onAuthStateChanged(callback: (user: User | null) => void) {
  return firebaseOnAuthStateChanged(getFirebaseAuth(), callback);
}

/**
 * Initiates Google sign-in using popup.
 *
 * Uses popup instead of redirect due to browser third-party storage
 * partitioning (Chrome 115+, Firefox 109+, Safari 16.1+) which breaks
 * redirect auth when app domain differs from Firebase authDomain.
 *
 * See: https://firebase.google.com/docs/auth/web/redirect-best-practices
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  return signInWithPopup(auth, provider);
}

export async function signOut() {
  return firebaseSignOut(getFirebaseAuth());
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string,
): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );

  // Set display name if provided
  if (userCredential.user && displayName) {
    const { updateProfile } = await import("firebase/auth");
    await updateProfile(userCredential.user, { displayName });
    // Force token refresh so the new token includes the displayName claim
    // This ensures ensureUserDocument gets the displayName from the decoded token
    await userCredential.user.getIdToken(true);
  }

  // Send verification email after successful signup
  if (userCredential.user) {
    // Note: This domain must be in Firebase Console → Authentication → Settings → Authorized domains
    // For ephemeral environments, you may need to temporarily add the domain
    // The url is where user will be redirected AFTER clicking the email link and action completes
    const actionCodeSettings = {
      url: `${window.location.origin}/`,
      handleCodeInApp: true,
    };
    console.info(
      "[auth] Sending verification email with action code settings",
      {
        actionUrl: actionCodeSettings.url,
        origin: window.location.origin,
        handleCodeInApp: actionCodeSettings.handleCodeInApp,
      },
    );
    await sendEmailVerification(userCredential.user, actionCodeSettings);
    console.info("[auth] Verification email sent successfully");
  }

  return userCredential;
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  return signInWithEmailAndPassword(auth, email, password);
}

export async function sendVerificationEmail(): Promise<void> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("No user is currently signed in");
  }
  const actionCodeSettings = {
    url: `${window.location.origin}/`,
    handleCodeInApp: true,
  };
  return sendEmailVerification(user, actionCodeSettings);
}

export async function resetPassword(email: string): Promise<void> {
  const auth = getFirebaseAuth();
  const actionCodeSettings = {
    url: `${window.location.origin}/`,
    handleCodeInApp: true,
  };
  return sendPasswordResetEmail(auth, email, actionCodeSettings);
}

/**
 * Force refresh the current user's authentication token and user data.
 * Useful when user has just verified their email or updated their profile,
 * but the cached token still shows old data (e.g., emailVerified: false).
 *
 * Example usage:
 * ```ts
 * try {
 *   await refreshUserToken();
 *   // Token refreshed - user.emailVerified should now reflect current state
 * } catch (error) {
 *   console.error("Failed to refresh token", error);
 * }
 * ```
 */
export async function refreshUserToken(): Promise<void> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("No user is currently signed in");
  }

  // Reload user data from Firebase
  await user.reload();

  // Force refresh the ID token (bypasses cache)
  await user.getIdToken(true);

  console.info("[auth] User token and data refreshed", {
    uid: user.uid,
    emailVerified: user.emailVerified,
  });
}
