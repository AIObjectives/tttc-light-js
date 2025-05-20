/**
 * Firebase Authentication (Client SDK)
 *
 * Handles user authentication in the browser using Firebase Auth.
 * This runs on the client side and manages user sign-in/sign-out flows.
 *
 * The client SDK authentication:
 * - Provides UI-based auth flows (Google popup, etc.)
 * - Manages auth state in the browser
 * - Generates ID tokens that can be sent to server
 * - Handles token refresh automatically
 */

import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged as _onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

import { getFirebaseAuth } from "./clientApp";
const auth = getFirebaseAuth();

/**
 * Listen for authentication state changes.
 * This is how React components stay in sync with auth state.
 */
export function onAuthStateChanged(cb) {
  return _onAuthStateChanged(auth, cb);
}

/**
 * Sign in with Google using a popup window.
 * Sets persistence to local storage so user stays signed in across browser sessions.
 */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  // Add scopes here if we need access to user data
  // ex: provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
  try {
    setPersistence(auth, browserLocalPersistence).then(
      async () => await signInWithPopup(auth, provider),
    );
  } catch (error) {
    console.error("Error signing in with Google", error);
  }
}

/**
 * Sign out the current user.
 * Clears auth state and tokens from the browser.
 */
export async function signOut() {
  try {
    return auth.signOut();
  } catch (error) {
    console.error("Error signing out with Google", error);
  }
}
