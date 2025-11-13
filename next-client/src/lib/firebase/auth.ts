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
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  UserCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import { getFirebaseAuth } from "./clientApp";

export function onAuthStateChanged(callback: (user: any) => void) {
  return firebaseOnAuthStateChanged(getFirebaseAuth(), callback);
}

/**
 * Initiates Google sign-in using redirect flow instead of popup.
 * This works across all browsers without popup blocker issues.
 * After calling this, the browser will redirect to Google's sign-in page,
 * and then redirect back to your app. Use handleRedirectResult() to
 * complete the sign-in after the redirect.
 */
export async function signInWithGoogle(): Promise<void> {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  // This will redirect the browser to Google's sign-in page
  return signInWithRedirect(auth, provider);
}

/**
 * Checks for redirect result after user returns from Google sign-in.
 * Call this when your app loads to complete the sign-in process.
 * Returns null if there's no pending redirect result.
 */
export async function handleRedirectResult(): Promise<UserCredential | null> {
  const auth = getFirebaseAuth();
  return getRedirectResult(auth);
}

export async function signOut() {
  return firebaseSignOut(getFirebaseAuth());
}

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );

  // Send verification email after successful signup
  if (userCredential.user) {
    await sendEmailVerification(userCredential.user);
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
  return sendEmailVerification(user);
}

export async function resetPassword(email: string): Promise<void> {
  const auth = getFirebaseAuth();
  return sendPasswordResetEmail(auth, email);
}
