/**
 * Firebase Authentication (Client SDK)
 *
 * Handles user authentication in the browser using Firebase Auth.
 * This runs on the client side and manages user sign-in/sign-out flows.
 *
 * The client SDK authentication:
 * - Google sign-in via redirect flow (avoids popup blockers)
 * - Email/password authentication
 * - Manages auth state in the browser via onAuthStateChanged
 * - Generates ID tokens that can be sent to server
 * - Handles token refresh automatically
 */

"use client";

import {
  signInWithRedirect,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  UserCredential,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import { getFirebaseAuth } from "./clientApp";

export function onAuthStateChanged(callback: (user: User | null) => void) {
  return firebaseOnAuthStateChanged(getFirebaseAuth(), callback);
}

// SessionStorage key for tracking Google sign-in redirect state
// Using sessionStorage (not localStorage) to prevent cross-tab interference
const GOOGLE_REDIRECT_PENDING_KEY = "google_signin_redirect_pending";

// Maximum age for the redirect flag (5 minutes) - prevents stale flags
const REDIRECT_FLAG_MAX_AGE_MS = 5 * 60 * 1000;

interface RedirectPendingData {
  timestamp: number;
  returnUrl?: string;
}

/**
 * Set a flag indicating a Google sign-in redirect is in progress.
 * Used to detect redirect completion in onAuthStateChanged.
 *
 * Uses sessionStorage to prevent cross-tab interference, and includes
 * a timestamp to expire stale flags (e.g., if user cancels the redirect).
 *
 * @param returnUrl - Optional URL to redirect to after sign-in completes
 */
export function setGoogleRedirectPending(returnUrl?: string): void {
  try {
    const data: RedirectPendingData = {
      timestamp: Date.now(),
      returnUrl:
        returnUrl ||
        (typeof window !== "undefined" ? window.location.pathname : undefined),
    };
    sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage may not be available (SSR, private browsing)
    console.debug("[auth] Could not set redirect pending flag");
  }
}

/**
 * Check if a Google sign-in redirect is pending and not expired.
 * Returns false if the flag is missing, expired, or invalid.
 */
export function isGoogleRedirectPending(): boolean {
  try {
    const value = sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY);
    if (!value) return false;

    const data = JSON.parse(value);
    const age = Date.now() - data.timestamp;

    // Expire stale flags (user may have cancelled the redirect)
    if (age > REDIRECT_FLAG_MAX_AGE_MS) {
      clearGoogleRedirectPending();
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Clear the Google sign-in redirect pending flag.
 */
export function clearGoogleRedirectPending(): void {
  try {
    sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
  } catch {
    // Ignore errors
  }
}

/**
 * Get the return URL from a pending Google sign-in redirect.
 * Returns null if no redirect is pending or if the flag has expired.
 */
export function getGoogleRedirectReturnUrl(): string | null {
  try {
    const value = sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY);
    if (!value) return null;

    const data: RedirectPendingData = JSON.parse(value);
    const age = Date.now() - data.timestamp;

    // Don't return URL if flag is expired
    if (age > REDIRECT_FLAG_MAX_AGE_MS) {
      return null;
    }

    return data.returnUrl || null;
  } catch {
    return null;
  }
}

/**
 * Initiates Google sign-in using redirect flow.
 *
 * Uses redirect instead of popup to avoid popup blockers in Safari and other
 * browsers. The redirect flow works as follows:
 * 1. Browser redirects to Google's sign-in page
 * 2. User authenticates with Google
 * 3. Google redirects back to the app
 * 4. Firebase SDK automatically completes authentication
 * 5. onAuthStateChanged fires with the authenticated user
 *
 * Note: We don't use getRedirectResult() because it returns null due to
 * third-party storage blocking in modern browsers (Chrome 115+, Firefox 109+,
 * Safari 16.1+). Instead, we rely on onAuthStateChanged to detect the user.
 *
 * See: https://firebase.google.com/docs/auth/web/redirect-best-practices
 */
export async function signInWithGoogle(): Promise<void> {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  setGoogleRedirectPending();
  return signInWithRedirect(auth, provider);
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
