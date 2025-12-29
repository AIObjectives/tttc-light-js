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

/**
 * Get the Firestore collection name by explicit environment parameter
 */
export function getCollectionNameForEnv(
  targetEnv: "development" | "production",
): string {
  return targetEnv === "production"
    ? REPORT_REF_COLLECTION
    : `${REPORT_REF_COLLECTION}_dev`;
}

/**
 * ReportRef document structure (minimal version for scripts)
 */
export interface ReportRefDoc {
  id: string;
  userId: string;
  reportDataUri: string;
  title: string;
  description: string;
  numTopics: number;
  numSubtopics: number;
  numClaims: number;
  numPeople: number;
  createdDate: admin.firestore.Timestamp;
  status?: string;
  processingSubState?: string | null;
  lastStatusUpdate?: admin.firestore.Timestamp;
  schemaVersion?: number;
  jobId?: string;
  _previousUri?: string;
}

/**
 * Find all ReportRefs pointing to a specific bucket
 * Uses range query since Firestore doesn't support startsWith
 */
export async function findReportRefsForBucket(
  db: admin.firestore.Firestore,
  bucketName: string,
  collectionName: string,
): Promise<Array<{ id: string; data: ReportRefDoc }>> {
  const uriPrefix = `https://storage.googleapis.com/${bucketName}/`;

  const snapshot = await db
    .collection(collectionName)
    .where("reportDataUri", ">=", uriPrefix)
    .where("reportDataUri", "<", `${uriPrefix}\uf8ff`)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as ReportRefDoc,
  }));
}

/**
 * Find a ReportRef by its reportDataUri
 */
export async function findReportRefByUri(
  db: admin.firestore.Firestore,
  reportDataUri: string,
  collectionName: string,
): Promise<{ id: string; data: ReportRefDoc } | null> {
  const snapshot = await db
    .collection(collectionName)
    .where("reportDataUri", "==", reportDataUri)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return { id: doc.id, data: doc.data() as ReportRefDoc };
}

/**
 * Update the reportDataUri for a ReportRef
 * Uses a transaction for atomicity and tracks previous URI for rollback
 */
export async function updateReportDataUri(
  db: admin.firestore.Firestore,
  collectionName: string,
  oldUri: string,
  newUri: string,
): Promise<{ id: string } | null> {
  return db.runTransaction(async (tx) => {
    const query = await db
      .collection(collectionName)
      .where("reportDataUri", "==", oldUri)
      .limit(1)
      .get();

    if (query.empty) {
      return null;
    }

    const doc = query.docs[0];
    tx.update(doc.ref, {
      reportDataUri: newUri,
      lastStatusUpdate: admin.firestore.Timestamp.now(),
      _previousUri: oldUri,
    });

    return { id: doc.id };
  });
}

/**
 * Copy a ReportRef from one collection to another (for cross-env transfers)
 * Creates a new document in the target collection with an updated reportDataUri
 *
 * Returns null if source not found, throws if target already exists (duplicate prevention)
 */
export async function copyReportRefToCollection(
  db: admin.firestore.Firestore,
  sourceCollection: string,
  targetCollection: string,
  sourceUri: string,
  newUri: string,
  newOwnerId?: string,
): Promise<{ sourceId: string; targetId: string } | null> {
  // Find source document
  const source = await findReportRefByUri(db, sourceUri, sourceCollection);
  if (!source) {
    return null;
  }

  // Check if target already exists (duplicate prevention)
  const existingTarget = await findReportRefByUri(db, newUri, targetCollection);
  if (existingTarget) {
    throw new Error(
      `Target already exists in ${targetCollection}: ${existingTarget.id}. ` +
        "Use --skip-copy with same-env migration to update existing entries.",
    );
  }

  // Create new document in target collection
  const targetRef = db.collection(targetCollection).doc();
  const newData: ReportRefDoc = {
    ...source.data,
    id: targetRef.id,
    reportDataUri: newUri,
    userId: newOwnerId || source.data.userId,
    lastStatusUpdate: admin.firestore.Timestamp.now(),
    _previousUri: sourceUri,
  };

  await targetRef.set(newData);

  return { sourceId: source.id, targetId: targetRef.id };
}

/**
 * Delete a ReportRef by ID
 */
export async function deleteReportRef(
  db: admin.firestore.Firestore,
  collectionName: string,
  docId: string,
): Promise<void> {
  await db.collection(collectionName).doc(docId).delete();
}

// Re-export firebase-admin for scripts that need additional functionality
export { admin };
