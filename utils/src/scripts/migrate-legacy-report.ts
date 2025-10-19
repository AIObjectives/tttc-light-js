#!/usr/bin/env tsx

/**
 * Migration script to create Firestore ReportRef entries for legacy reports
 *
 * This script migrates reports that exist in Google Cloud Storage but lack
 * Firestore database entries. Use this for:
 * - Demo reports displayed on talktothe.city homepage
 * - Old reports from the previous product hosted at a different domain
 * - Any reports currently accessed via legacy storage URLs
 *
 * Migrating to ID-based URLs enables:
 * - Cleaner URLs (/report/{id} instead of encoded storage paths)
 * - Eventual deprecation of the legacy storage URL format
 * - Consistent report handling across old and new reports
 *
 * Ownership Transfer:
 * If a report already has a Firestore entry but is owned by a different user,
 * the script will offer to transfer ownership to the specified user. This is
 * useful for consolidating demo reports under a single demo account.
 *
 * Prerequisites:
 * 1. Set LEGACY_REPORT_USER_ID in express-server/.env
 *    - For demo reports: Use the Firebase UID of the configured demo account
 *    - For legacy reports: Use your account or create a dedicated "legacy" user
 *    - The UID can be found in Firebase Console (Authentication > Users)
 *
 * Usage:
 *   npm run migrate-legacy -- "https://storage.googleapis.com/tttc-light-newbucket/heal_michigan_t3c.json"
 *   npm run migrate-legacy -- "tttc-light-newbucket/heal_michigan_t3c.json"
 *   npm run migrate-legacy -- --dry-run "bucket/file.json"
 *
 * Options:
 *   --dry-run    Preview the migration without writing to Firestore
 *   --force      Force ownership transfer without confirmation (use with caution)
 *   --help       Show this help message
 */

import { Storage } from "@google-cloud/storage";
import * as admin from "firebase-admin";
import * as schema from "tttc-common/schema";
import { z } from "zod";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load environment from express-server/.env
const envPath = resolve(process.cwd(), "../express-server/.env");
dotenv.config({ path: envPath });

// Validate required environment variables
const envSchema = z.object({
  FIREBASE_CREDENTIALS_ENCODED: z.string().min(1),
  LEGACY_REPORT_USER_ID: z.string().min(1),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
});

type Env = z.infer<typeof envSchema>;

// Collection name (from common/firebase)
const REPORT_REF_COLLECTION = "reportRef";

// Schema version for legacy reports
const LEGACY_REPORT_SCHEMA_VERSION = 1;

const getCollectionName = (env: Env) => {
  return env.NODE_ENV === "production"
    ? REPORT_REF_COLLECTION
    : `${REPORT_REF_COLLECTION}_dev`;
};

/**
 * Parse GCS URI into bucket and fileName
 */
function parseGcsUri(uri: string): { bucket: string; fileName: string } | null {
  // Try URL-encoded format from browser URL bar first
  // e.g., https://talktothe.city/report/https%3A%2F%2Fstorage.googleapis.com%2F...
  const encodedMatch = uri.match(/\/report\/(https%3A%2F%2F[^?#]+)/);
  if (encodedMatch) {
    const decodedUri = decodeURIComponent(encodedMatch[1]);
    return parseGcsUri(decodedUri); // Recursively parse the decoded URI
  }

  // Try full URL format
  const urlMatch = uri.match(
    /https:\/\/storage\.googleapis\.com\/([^\/]+)\/(.+)/,
  );
  if (urlMatch) {
    return { bucket: urlMatch[1], fileName: urlMatch[2] };
  }

  // Try bucket/file format
  const pathMatch = uri.match(/^([^\/]+)\/(.+)$/);
  if (pathMatch) {
    return { bucket: pathMatch[1], fileName: pathMatch[2] };
  }

  return null;
}

/**
 * Extract metadata from report JSON
 */
function extractMetadata(reportData: schema.PipelineOutput): {
  title: string;
  description: string;
  numTopics: number;
  numSubtopics: number;
  numClaims: number;
  numPeople: number;
  createdDate: Date;
  dateFromFallback: boolean;
} {
  const [dataVersion, dataObj] = reportData.data;

  // Validate data version
  if (dataVersion !== "v0.2") {
    throw new Error(
      `Unsupported data version: ${dataVersion}. Only v0.2 is supported for legacy reports.`,
    );
  }

  const topics = dataObj.topics;

  // Count subtopics and claims
  const numSubtopics = topics.reduce(
    (sum, topic) => sum + topic.subtopics.length,
    0,
  );
  const numClaims = topics.reduce(
    (sum, topic) =>
      sum +
      topic.subtopics.reduce((subSum, sub) => subSum + sub.claims.length, 0),
    0,
  );

  // Count unique people (speakers)
  const speakers = new Set<string>();
  topics.forEach((topic) => {
    topic.subtopics.forEach((subtopic) => {
      subtopic.claims.forEach((claim) => {
        claim.quotes.forEach((quote) => {
          speakers.add(quote.reference.interview);
        });
      });
    });
  });

  // Get date from metadata or use current date
  const [, metadataObj] = reportData.metadata;
  let createdDate: Date;
  let dateFromFallback = false;

  if (metadataObj.startTimestamp) {
    createdDate = new Date(metadataObj.startTimestamp);
  } else {
    createdDate = new Date();
    dateFromFallback = true;
  }

  return {
    title: dataObj.title,
    description: dataObj.description,
    numTopics: topics.length,
    numSubtopics,
    numClaims,
    numPeople: speakers.size,
    createdDate,
    dateFromFallback,
  };
}

/**
 * Validate and return environment configuration
 */
function validateEnvironment(): Env {
  console.log("\nValidating environment...");
  const envResult = envSchema.safeParse(process.env);
  if (!envResult.success) {
    console.error("ERROR: Environment validation failed:");
    console.error(envResult.error.format());
    console.error("\nMissing or invalid environment variables:");
    console.error("- FIREBASE_CREDENTIALS_ENCODED (from express-server/.env)");
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
async function initializeFirebase(env: Env): Promise<{
  app: admin.app.App;
  db: admin.firestore.Firestore;
  storage: Storage;
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
  } catch (error) {
    console.error("ERROR: Owner user not found in Firebase Auth");
    console.error(`   User ID: ${env.LEGACY_REPORT_USER_ID}`);
    console.error(
      "   Create the user in Firebase Console (Authentication > Users)",
    );
    throw new Error("Owner user not found in Firebase Auth");
  }

  // Initialize GCS
  console.log("\nInitializing Google Cloud Storage...");
  const storage = new Storage({
    credentials: firebaseCredentials,
  });
  console.log("   Storage initialized");

  return { app, db, storage };
}

/**
 * Handle existing report - check ownership and potentially transfer
 */
async function handleExistingReport(
  existingDoc: admin.firestore.QueryDocumentSnapshot,
  env: Env,
  gcsUri: string,
  dryRun: boolean,
  forceUpdate: boolean,
): Promise<void> {
  const existingData = existingDoc.data();
  const currentOwnerId = existingData.userId;

  console.log(`   Found existing report:`);
  console.log(`   Document ID: ${existingDoc.id}`);
  console.log(`   Current owner: ${currentOwnerId}`);
  console.log(`   URL: /report/${existingDoc.id}`);

  if (currentOwnerId === env.LEGACY_REPORT_USER_ID) {
    console.log("\nReport already owned by specified user - no action needed");
    return; // Early return, no changes needed
  }

  // Different owner - offer to update
  console.log(`\nOwnership differs:`);
  console.log(`   Current: ${currentOwnerId}`);
  console.log(`   Target:  ${env.LEGACY_REPORT_USER_ID}`);

  if (dryRun) {
    console.log("\nDRY RUN MODE - Would update ownership if confirmed");
    console.log(`   Would change userId from: ${currentOwnerId}`);
    console.log(`   To: ${env.LEGACY_REPORT_USER_ID}`);
    console.log(
      "\nTo update ownership, re-run without --dry-run and use --force",
    );
    return;
  }

  // Require --force flag for ownership transfer
  if (!forceUpdate) {
    console.log(
      "\nWARNING: Report ownership would be transferred to a different user.",
    );
    console.log(
      "To proceed with ownership transfer, re-run with --force flag:",
    );
    console.log(`  npm run migrate-legacy -- --force "${gcsUri}"`);
    throw new Error("Ownership transfer requires --force flag");
  }

  // Update ownership
  console.log("\nUpdating report ownership...");
  await existingDoc.ref.update({
    userId: env.LEGACY_REPORT_USER_ID,
    lastStatusUpdate: admin.firestore.Timestamp.now(),
  });

  console.log("   Ownership updated successfully");
  console.log(`\nMigration complete!`);
  console.log(`\nReport URL: /report/${existingDoc.id}`);
  console.log(
    `   Ownership transferred from ${currentOwnerId} to ${env.LEGACY_REPORT_USER_ID}`,
  );
}

/**
 * Download and validate report from GCS
 */
async function downloadAndValidateReport(
  storage: Storage,
  bucket: string,
  fileName: string,
): Promise<schema.PipelineOutput> {
  console.log("\nDownloading report from GCS...");
  const [fileContent] = await storage.bucket(bucket).file(fileName).download();
  console.log(`   Downloaded ${fileContent.length} bytes`);

  console.log("\nParsing report JSON...");
  const reportData = schema.pipelineOutput.parse(
    JSON.parse(fileContent.toString()),
  );
  console.log("   Valid report structure confirmed");

  return reportData;
}

/**
 * Display metadata summary
 */
function displayMetadataSummary(
  metadata: ReturnType<typeof extractMetadata>,
): void {
  console.log("\nExtracting metadata...");
  console.log(`   Title: ${metadata.title}`);
  const descPreview =
    metadata.description.length > 80
      ? metadata.description.substring(0, 80) + "..."
      : metadata.description;
  console.log(`   Description: ${descPreview}`);
  console.log(`   Topics: ${metadata.numTopics}`);
  console.log(`   Subtopics: ${metadata.numSubtopics}`);
  console.log(`   Claims: ${metadata.numClaims}`);
  console.log(`   People: ${metadata.numPeople}`);
  console.log(`   Date: ${metadata.createdDate.toISOString()}`);
  if (metadata.dateFromFallback) {
    console.log(
      "   WARNING: No timestamp in report metadata, using current date",
    );
  }
}

/**
 * Create new ReportRef in Firestore
 */
async function createReportRef(
  db: admin.firestore.Firestore,
  env: Env,
  reportDataUri: string,
  metadata: ReturnType<typeof extractMetadata>,
): Promise<string> {
  console.log("\nCreating Firestore ReportRef...");
  const reportRefDoc = db.collection(getCollectionName(env)).doc();

  await reportRefDoc.set({
    id: reportRefDoc.id,
    userId: env.LEGACY_REPORT_USER_ID,
    reportDataUri,
    title: metadata.title,
    description: metadata.description,
    numTopics: metadata.numTopics,
    numSubtopics: metadata.numSubtopics,
    numClaims: metadata.numClaims,
    numPeople: metadata.numPeople,
    createdDate: admin.firestore.Timestamp.fromDate(metadata.createdDate),
    status: "completed",
    processingSubState: null,
    lastStatusUpdate: admin.firestore.Timestamp.now(),
    schemaVersion: LEGACY_REPORT_SCHEMA_VERSION,
  });

  console.log("   ReportRef created successfully");
  console.log(`   Document ID: ${reportRefDoc.id}`);
  return reportRefDoc.id;
}

/**
 * Main migration function
 */
async function migrateReport(
  gcsUri: string,
  dryRun: boolean = false,
  forceUpdate: boolean = false,
): Promise<void> {
  // Parse and validate URI
  console.log("\nParsing GCS URI...");
  const parsed = parseGcsUri(gcsUri);
  if (!parsed) {
    console.error("ERROR: Invalid GCS URI format");
    console.error(
      "   Expected: https://storage.googleapis.com/bucket/file.json",
    );
    console.error("   Or: bucket/file.json");
    throw new Error("Invalid GCS URI format");
  }

  const { bucket, fileName } = parsed;
  const reportDataUri = `https://storage.googleapis.com/${bucket}/${fileName}`;
  console.log(`   Bucket: ${bucket}`);
  console.log(`   File: ${fileName}`);
  console.log(`   Full URI: ${reportDataUri}`);

  // Setup
  const env = validateEnvironment();
  const { db, storage } = await initializeFirebase(env);

  // Check if report already exists
  console.log("\nChecking for existing ReportRef...");
  const existingQuery = await db
    .collection(getCollectionName(env))
    .where("reportDataUri", "==", reportDataUri)
    .limit(1)
    .get();

  if (!existingQuery.empty) {
    await handleExistingReport(
      existingQuery.docs[0],
      env,
      gcsUri,
      dryRun,
      forceUpdate,
    );
    return; // Exit after handling existing report
  }
  console.log("   No existing entry found - proceeding with migration");

  // Download and validate report
  const reportData = await downloadAndValidateReport(storage, bucket, fileName);
  const metadata = extractMetadata(reportData);
  displayMetadataSummary(metadata);

  // Handle dry run
  if (dryRun) {
    console.log("\nDRY RUN MODE - No changes will be made");
    console.log("\nWould create ReportRef with:");
    console.log(`   userId: ${env.LEGACY_REPORT_USER_ID}`);
    console.log(`   reportDataUri: ${reportDataUri}`);
    console.log(`   status: completed`);
    console.log(`   title: ${metadata.title}`);
    console.log(`   description: ${metadata.description}`);
    console.log(`   numTopics: ${metadata.numTopics}`);
    console.log(`   numSubtopics: ${metadata.numSubtopics}`);
    console.log(`   numClaims: ${metadata.numClaims}`);
    console.log(`   numPeople: ${metadata.numPeople}`);
    console.log(`   createdDate: ${metadata.createdDate.toISOString()}`);
    console.log("\nDry run complete - re-run without --dry-run to migrate");
    return;
  }

  // Create new report
  const reportId = await createReportRef(db, env, reportDataUri, metadata);
  console.log(`\nMigration complete!`);
  console.log(`\nNew URL: /report/${reportId}`);
  console.log(`   (Old URL: ${reportDataUri})`);
}

// Parse CLI arguments
const args = process.argv.slice(2);

if (args.includes("--help") || args.length === 0) {
  console.log(`
Migration script to create Firestore ReportRef entries for legacy reports

Usage:
  npm run migrate-legacy -- "https://storage.googleapis.com/bucket/file.json"
  npm run migrate-legacy -- "bucket/file.json"
  npm run migrate-legacy -- --dry-run "bucket/file.json"
  npm run migrate-legacy -- --force "bucket/file.json"

Options:
  --dry-run    Preview the migration without writing to Firestore
  --force      Force ownership transfer without confirmation (use with caution)
  --help       Show this help message

For detailed documentation including prerequisites and environment setup,
see the header comment in this file.
`);
  process.exit(0);
}

const dryRun = args.includes("--dry-run");
const forceUpdate = args.includes("--force");
const gcsUri = args.find((arg) => !arg.startsWith("--"));

if (!gcsUri) {
  console.error("ERROR: GCS URI required");
  console.error('Usage: npm run migrate-legacy -- "bucket/file.json"');
  console.error("Run with --help for more information");
  process.exit(1);
}

// Run migration
migrateReport(gcsUri, dryRun, forceUpdate)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nERROR: Unexpected error:");
    console.error(error);
    process.exit(1);
  });
