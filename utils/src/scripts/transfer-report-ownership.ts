#!/usr/bin/env tsx

/**
 * Transfer ownership of a report to the configured demo user
 *
 * This script transfers ownership of an existing report in Firestore to the
 * user specified by LEGACY_REPORT_USER_ID. Use this for:
 * - Consolidating demo reports under a single demo account
 * - Reassigning reports created during testing to the proper owner
 *
 * Prerequisites:
 * 1. Ensure express-server/.env has the required credentials:
 *    - FIREBASE_CREDENTIALS_ENCODED: Firebase Admin SDK credentials
 * 2. Set LEGACY_REPORT_USER_ID in express-server/.env
 *    - The Firebase UID of the target owner
 *    - The UID can be found in Firebase Console (Authentication > Users)
 *
 * Usage (from repository root):
 *   pnpm -F utils transfer-ownership -- --dry-run QQ4zmwM85f43EejP3QDT
 *   pnpm -F utils transfer-ownership -- --force QQ4zmwM85f43EejP3QDT
 *
 * Or from utils directory:
 *   cd utils && pnpm transfer-ownership -- --force QQ4zmwM85f43EejP3QDT
 *
 * Options:
 *   --dry-run    Preview the transfer without writing to Firestore
 *   --force      Confirm and execute the ownership transfer
 *   --help       Show this help message
 */

import {
  admin,
  getCollectionName,
  initializeFirebase,
  validateEnvironment,
} from "./shared/firebase-admin";

/**
 * Transfer ownership of a report to the configured user
 */
async function transferOwnership(
  reportId: string,
  dryRun: boolean = false,
  forceUpdate: boolean = false,
): Promise<void> {
  console.log(`\nTransferring ownership for report: ${reportId}`);

  // Setup
  const env = validateEnvironment();
  const { db } = await initializeFirebase(env);

  // Look up report by document ID
  console.log("\nLooking up report...");
  const collectionName = getCollectionName(env);
  const reportDoc = await db.collection(collectionName).doc(reportId).get();

  if (!reportDoc.exists) {
    console.error(`ERROR: Report not found: ${reportId}`);
    console.error(`   Collection: ${collectionName}`);
    console.error("   Verify the report ID is correct and exists in Firestore");
    throw new Error("Report not found");
  }

  const reportData = reportDoc.data();
  if (!reportData) {
    throw new Error("Report data is empty");
  }

  const currentOwnerId = reportData.userId;
  const reportTitle = reportData.title || "(no title)";

  console.log(`   Found report: ${reportTitle}`);
  console.log(`   Document ID: ${reportId}`);
  console.log(`   Current owner: ${currentOwnerId}`);
  console.log(`   URL: /report/${reportId}`);

  // Check if ownership already matches
  if (currentOwnerId === env.LEGACY_REPORT_USER_ID) {
    console.log("\nReport already owned by target user - no action needed");
    return;
  }

  // Show ownership change
  console.log(`\nOwnership transfer:`);
  console.log(`   From: ${currentOwnerId}`);
  console.log(`   To:   ${env.LEGACY_REPORT_USER_ID}`);

  // Handle dry run
  if (dryRun) {
    console.log("\nDRY RUN MODE - No changes will be made");
    console.log(`   Would update userId from: ${currentOwnerId}`);
    console.log(`   To: ${env.LEGACY_REPORT_USER_ID}`);
    console.log("\nTo execute the transfer, re-run with --force flag");
    return;
  }

  // Require --force flag for ownership transfer
  if (!forceUpdate) {
    console.log(
      "\nWARNING: Report ownership will be transferred to a different user.",
    );
    console.log(
      "To proceed with ownership transfer, re-run with --force flag:",
    );
    console.log(`  pnpm -F utils transfer-ownership -- --force "${reportId}"`);
    throw new Error("Ownership transfer requires --force flag");
  }

  // Update ownership
  console.log("\nUpdating report ownership...");
  await reportDoc.ref.update({
    userId: env.LEGACY_REPORT_USER_ID,
    lastStatusUpdate: admin.firestore.Timestamp.now(),
  });

  console.log("   Ownership updated successfully");
  console.log(`\nTransfer complete!`);
  console.log(`\nReport URL: /report/${reportId}`);
  console.log(
    `   Ownership transferred from ${currentOwnerId} to ${env.LEGACY_REPORT_USER_ID}`,
  );
}

// Parse CLI arguments
const args = process.argv.slice(2);

if (args.includes("--help") || args.length === 0) {
  console.log(`
Transfer ownership of a report to the configured demo user

Usage (from repository root):
  pnpm -F utils transfer-ownership -- --dry-run <reportId>
  pnpm -F utils transfer-ownership -- --force <reportId>

Options:
  --dry-run    Preview the transfer without writing to Firestore
  --force      Confirm and execute the ownership transfer
  --help       Show this help message

Example:
  pnpm -F utils transfer-ownership -- --dry-run QQ4zmwM85f43EejP3QDT
  pnpm -F utils transfer-ownership -- --force QQ4zmwM85f43EejP3QDT

The target owner is configured via LEGACY_REPORT_USER_ID in express-server/.env
`);
  process.exit(0);
}

const dryRun = args.includes("--dry-run");
const forceUpdate = args.includes("--force");

const reportId = args.find((arg) => !arg.startsWith("--"));

if (!reportId) {
  console.error("ERROR: Report ID required");
  console.error(
    'Usage: pnpm -F utils transfer-ownership -- --force "reportId"',
  );
  console.error("Run with --help for more information");
  process.exit(1);
}

// Run transfer
transferOwnership(reportId, dryRun, forceUpdate)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nERROR:", error.message || error);
    process.exit(1);
  });
