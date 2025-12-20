/**
 * Firebase Client SDK Setup
 *
 * This file initializes the Firebase Client SDK which runs in the browser.
 * The client SDK is used for:
 * - User authentication (sign in/out)
 * - Real-time database operations from the browser
 * - Client-side security rules enforcement
 * - Offline capabilities
 *
 * Key differences from server SDK:
 * - Runs in browser environment with limited privileges
 * - Authentication happens through user login flows
 * - Security rules are enforced by Firebase servers
 * - Can work offline and sync when reconnected
 *
 * Configuration is embedded at build time via Next.js environment variables.
 */

"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFirebaseConfig } from "./config";

let firebaseApp: ReturnType<typeof initializeApp> | undefined;

/**
 * Get or create the Firebase app instance for client-side use.
 * Ensures only one app instance exists (singleton pattern).
 * Configuration is loaded at build time.
 */
export function getFirebaseApp() {
  if (!firebaseApp) {
    firebaseApp =
      getApps().length === 0
        ? initializeApp(getFirebaseConfig())
        : getApps()[0];
  }
  return firebaseApp;
}

/**
 * Get Firebase Auth instance for client-side authentication.
 * Handles user sign-in/sign-out and auth state management.
 */
export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

/**
 * Get Firestore database instance for client-side operations.
 * All operations go through Firebase security rules.
 */
export function getFirebaseDb() {
  return getFirestore(getFirebaseApp());
}

/**
 * Get Firebase Storage instance for client-side file operations.
 */
export function getFirebaseStorage() {
  return getStorage(getFirebaseApp());
}
