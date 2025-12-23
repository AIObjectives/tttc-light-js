/**
 * Shared Firebase Admin utilities for CLI scripts
 *
 * This module provides common functionality for scripts that need to interact
 * with Firebase Admin SDK, including environment validation and initialization.
 */

import { resolve } from "node:path";
import * as dotenv from "dotenv";
import * as admin from "firebase-admin";
import { z } from "zod";

// Load environment from express-server/.env
const envPath = resolve(process.cwd(), "../express-server/.env");
dotenv.config({ path: envPath });

// Validate required environment variables
export const envSchema = z.object({
  FIREBASE_CREDENTIALS_ENCODED: z.string().min(1),
  GOOGLE_CREDENTIALS_ENCODED: z.string().min(1),
  LEGACY_REPORT_USER_ID: z.string().min(1),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

// Collection name (from common/firebase)
export const REPORT_REF_COLLECTION = "reportRef";

/**
 * Get the Firestore collection name based on environment
 */
export function getCollectionName(env: Env): string {
  return env.NODE_ENV === "production"
    ? REPORT_REF_COLLECTION
    : `${REPORT_REF_COLLECTION}_dev`;
}

/**
 * Validate and return environment configuration
 */
export function validateEnvironment(): Env {
  console.log("\nValidating environment...");
  const envResult = envSchema.safeParse(process.env);
  if (!envResult.success) {
    console.error("ERROR: Environment validation failed:");
    console.error(envResult.error.format());
    console.error("\nMissing or invalid environment variables:");
    console.error("- FIREBASE_CREDENTIALS_ENCODED (from express-server/.env)");
    console.error("- GOOGLE_CREDENTIALS_ENCODED (from express-server/.env)");
    console.error(
      "- LEGACY_REPORT_USER_ID (create owner user first, see script header)",
    );
    throw new Error("Environment validation failed");
  }
  const env = envResult.data;
  console.log(`   Environment: ${env.NODE_ENV}`);
  console.log(`   Owner User ID: ${env.LEGACY_REPORT_USER_ID}`);
  return env;
}

/**
 * Initialize Firebase Admin and validate user
 */
export async function initializeFirebase(env: Env): Promise<{
  app: admin.app.App;
  db: admin.firestore.Firestore;
}> {
  console.log("\nInitializing Firebase...");
  const firebaseCredentials = JSON.parse(
    Buffer.from(env.FIREBASE_CREDENTIALS_ENCODED, "base64").toString("utf-8"),
  );
  const app = admin.apps.length
    ? admin.app()
    : admin.initializeApp({
        credential: admin.credential.cert(firebaseCredentials),
      });
  const db = admin.firestore(app);
  console.log("   Firebase initialized");

  // Validate user exists
  console.log("\nValidating owner user...");
  try {
    const userRecord = await admin.auth(app).getUser(env.LEGACY_REPORT_USER_ID);
    console.log(`   User verified: ${userRecord.email || userRecord.uid}`);
  } catch (_error) {
    console.error("ERROR: Owner user not found in Firebase Auth");
    console.error(`   User ID: ${env.LEGACY_REPORT_USER_ID}`);
    console.error(
      "   Create the user in Firebase Console (Authentication > Users)",
    );
    throw new Error("Owner user not found in Firebase Auth");
  }

  return { app, db };
}

// Re-export firebase-admin for scripts that need additional functionality
export { admin };
