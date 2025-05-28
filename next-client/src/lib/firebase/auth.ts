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

"use client";

import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirebaseAuth } from "./clientApp";

export function onAuthStateChanged(callback: (user: any) => void) {
  return firebaseOnAuthStateChanged(getFirebaseAuth(), callback);
}

export async function signInWithGoogle() {
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
