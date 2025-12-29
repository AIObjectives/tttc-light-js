#!/usr/bin/env tsx

/**
 * Report Tool - CLI for managing reports across GCS buckets and Firestore environments
 *
 * This tool helps with:
 * - Auditing reports in buckets and cross-referencing with Firestore
 * - Migrating reports between buckets and/or Firestore environments
 * - Verifying reports are accessible after migration
 *
 * Usage:
 *   pnpm -F utils report -- audit --bucket tttc-light-newbucket --env prod
 *   pnpm -F utils report -- migrate --source old-bucket --target new-bucket --source-env dev --target-env prod
 *   pnpm -F utils report -- verify --bucket tttc-light-prod --env prod
 *
 * Prerequisites:
 *   - FIREBASE_CREDENTIALS_ENCODED in express-server/.env
 *   - GOOGLE_CREDENTIALS_ENCODED in express-server/.env
 *   - LEGACY_REPORT_USER_ID in express-server/.env (for creating new refs)
 */

import { Storage } from "@google-cloud/storage";
import * as schema from "tttc-common/schema";
import {
  type admin,
  copyReportRefToCollection,
  deleteReportRef,
  type Env,
  findReportRefByUri,
  findReportRefsForBucket,
  getCollectionNameForEnv,
  initializeFirebase as initializeFirebaseBase,
  updateReportDataUri,
  validateEnvironment,
} from "./shared/firebase-admin";
import {
  buildGcsUri,
  copyFileBetweenBuckets,
  downloadFile,
  fileExists,
  listBucketReports,
  parseGcsUri,
  validateBucketAccess,
} from "./shared/gcs-helpers";

// ============================================================================
// Types
// ============================================================================

type FirestoreEnv = "dev" | "prod";

interface AuditOptions {
  bucket: string;
  env: FirestoreEnv;
  json: boolean;
}

interface MigrateOptions {
  source: string;
  target: string;
  sourceEnv: FirestoreEnv;
  targetEnv: FirestoreEnv;
  file?: string;
  force: boolean;
  skipCopy: boolean;
  ownerId?: string;
  json: boolean;
  deleteSource: boolean;
}

interface VerifyOptions {
  bucket: string;
  env: FirestoreEnv;
  full: boolean;
  json: boolean;
}

interface AuditResult {
  bucket: string;
  env: FirestoreEnv;
  files: {
    total: number;
    withFirestore: string[];
    orphaned: string[];
  };
  firestore: {
    total: number;
    matching: string[];
  };
}

interface MigrateResult {
  file: string;
  sourceUri: string;
  targetUri: string;
  copyResult: "copied" | "skipped" | "error";
  firestoreResult: "updated" | "transferred" | "not-found" | "error";
  newDocId?: string;
  error?: string;
}

interface VerifyResult {
  file: string;
  uri: string;
  gcsExists: boolean;
  firestoreExists: boolean;
  schemaValid?: boolean;
  error?: string;
}

// ============================================================================
// Initialization
// ============================================================================

function envToFirestoreEnv(env: FirestoreEnv): "development" | "production" {
  return env === "prod" ? "production" : "development";
}

async function initializeServices(env: Env): Promise<{
  app: admin.app.App;
  db: admin.firestore.Firestore;
  storage: Storage;
}> {
  const { app, db } = await initializeFirebaseBase(env);

  console.log("\nInitializing Google Cloud Storage...");
  const gcsCredentials = JSON.parse(
    Buffer.from(env.GOOGLE_CREDENTIALS_ENCODED, "base64").toString("utf-8"),
  );
  const storage = new Storage({ credentials: gcsCredentials });
  console.log("   Storage initialized");

  return { app, db, storage };
}

// ============================================================================
// Audit Mode - Helper Functions
// ============================================================================

function categorizeFiles(
  files: string[],
  bucket: string,
  firestoreUris: Set<string>,
): { withFirestore: string[]; orphaned: string[] } {
  const withFirestore: string[] = [];
  const orphaned: string[] = [];

  for (const file of files) {
    const uri = buildGcsUri(bucket, file);
    if (firestoreUris.has(uri)) {
      withFirestore.push(file);
    } else {
      orphaned.push(file);
    }
  }

  return { withFirestore, orphaned };
}

function printAuditSummary(
  result: AuditResult,
  collectionName: string,
  json: boolean,
): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("\n=== AUDIT RESULTS ===");
  console.log(`\nBucket: ${result.bucket}`);
  console.log(`Firestore env: ${result.env} (collection: ${collectionName})`);
  console.log(`\nGCS Files: ${result.files.total}`);
  console.log(`  - With Firestore entry: ${result.files.withFirestore.length}`);
  console.log(`  - Orphaned (no Firestore): ${result.files.orphaned.length}`);
  console.log(
    `\nFirestore entries pointing to this bucket: ${result.firestore.total}`,
  );

  if (result.files.orphaned.length > 0) {
    printOrphanedFiles(result.files.orphaned);
  }
}

function printOrphanedFiles(orphaned: string[]): void {
  console.log("\nOrphaned files (exist in GCS but not in Firestore):");
  const displayCount = Math.min(10, orphaned.length);
  for (const file of orphaned.slice(0, displayCount)) {
    console.log(`  - ${file}`);
  }
  if (orphaned.length > 10) {
    console.log(`  ... and ${orphaned.length - 10} more`);
  }
}

// ============================================================================
// Audit Mode
// ============================================================================

async function runAudit(options: AuditOptions): Promise<void> {
  console.log("\n=== AUDIT MODE ===");
  console.log(`Bucket: ${options.bucket}`);
  console.log(`Environment: ${options.env}`);

  const env = validateEnvironment();
  const { db, storage } = await initializeServices(env);

  console.log("\nValidating bucket access...");
  const accessResult = await validateBucketAccess(
    storage,
    options.bucket,
    "read",
  );
  if (!accessResult.success) {
    console.error(
      `ERROR: Cannot read bucket ${options.bucket}: ${accessResult.error}`,
    );
    process.exit(1);
  }
  console.log("   Bucket accessible");

  console.log("\nListing files in bucket...");
  const files = await listBucketReports(storage, options.bucket);
  console.log(`   Found ${files.length} JSON files`);

  const collectionName = getCollectionNameForEnv(
    envToFirestoreEnv(options.env),
  );
  console.log(`\nQuerying Firestore collection: ${collectionName}`);

  const firestoreRefs = await findReportRefsForBucket(
    db,
    options.bucket,
    collectionName,
  );
  console.log(`   Found ${firestoreRefs.length} ReportRefs`);

  const firestoreUris = new Set(firestoreRefs.map((r) => r.data.reportDataUri));
  const { withFirestore, orphaned } = categorizeFiles(
    files,
    options.bucket,
    firestoreUris,
  );

  const result: AuditResult = {
    bucket: options.bucket,
    env: options.env,
    files: {
      total: files.length,
      withFirestore,
      orphaned,
    },
    firestore: {
      total: firestoreRefs.length,
      matching: firestoreRefs.map(
        (r) =>
          parseGcsUri(r.data.reportDataUri)?.fileName || r.data.reportDataUri,
      ),
    },
  };

  printAuditSummary(result, collectionName, options.json);
}

// ============================================================================
// Migrate Mode - Helper Functions
// ============================================================================

interface CopyFileContext {
  storage: Storage;
  source: string;
  target: string;
  file: string;
  isDryRun: boolean;
}

async function copyFileIfNeeded(
  ctx: CopyFileContext,
  skipCopy: boolean,
): Promise<MigrateResult["copyResult"]> {
  if (skipCopy) {
    console.log("   GCS: Skip copy mode, not copying file");
    return "skipped";
  }

  const targetExists = await fileExists(ctx.storage, ctx.target, ctx.file);
  if (targetExists) {
    console.log("   GCS: Target already exists, skipping copy");
    return "skipped";
  }

  if (ctx.isDryRun) {
    console.log("   GCS: Would copy file (dry run)");
    return "skipped";
  }

  console.log("   GCS: Copying file...");
  const copyResult = await copyFileBetweenBuckets(
    ctx.storage,
    { bucket: ctx.source, file: ctx.file },
    { bucket: ctx.target, file: ctx.file },
  );

  if (!copyResult.success) {
    throw new Error("Copy verification failed");
  }

  console.log(`   GCS: Copied (${(copyResult.size / 1024).toFixed(1)} KB)`);
  return "copied";
}

interface FirestoreTransferContext {
  db: admin.firestore.Firestore;
  sourceCollection: string;
  targetCollection: string;
  sourceUri: string;
  targetUri: string;
  ownerId: string;
  deleteSource: boolean;
  isDryRun: boolean;
}

async function transferFirestoreRef(
  ctx: FirestoreTransferContext,
): Promise<{ status: MigrateResult["firestoreResult"]; docId?: string }> {
  const existingRef = await findReportRefByUri(
    ctx.db,
    ctx.sourceUri,
    ctx.sourceCollection,
  );

  if (!existingRef) {
    console.log("   Firestore: No source entry found");
    return { status: "not-found" };
  }

  if (ctx.isDryRun) {
    console.log(
      `   Firestore: Would transfer from ${ctx.sourceCollection} to ${ctx.targetCollection}`,
    );
    return { status: "transferred" };
  }

  console.log(`   Firestore: Transferring to ${ctx.targetCollection}...`);
  const transferResult = await copyReportRefToCollection(
    ctx.db,
    ctx.sourceCollection,
    ctx.targetCollection,
    ctx.sourceUri,
    ctx.targetUri,
    ctx.ownerId,
  );

  if (!transferResult) {
    return { status: "error" };
  }

  console.log(`   Firestore: Created ${transferResult.targetId}`);

  if (ctx.deleteSource) {
    await deleteReportRef(
      ctx.db,
      ctx.sourceCollection,
      transferResult.sourceId,
    );
    console.log(`   Firestore: Deleted source ${transferResult.sourceId}`);
  }

  return { status: "transferred", docId: transferResult.targetId };
}

interface FirestoreUpdateContext {
  db: admin.firestore.Firestore;
  collection: string;
  sourceUri: string;
  targetUri: string;
  isDryRun: boolean;
}

async function updateFirestoreRef(
  ctx: FirestoreUpdateContext,
): Promise<{ status: MigrateResult["firestoreResult"]; docId?: string }> {
  const existingRef = await findReportRefByUri(
    ctx.db,
    ctx.sourceUri,
    ctx.collection,
  );

  if (!existingRef) {
    console.log("   Firestore: No entry found");
    return { status: "not-found" };
  }

  if (ctx.isDryRun) {
    console.log("   Firestore: Would update URI");
    return { status: "updated" };
  }

  console.log("   Firestore: Updating URI...");
  const updateResult = await updateReportDataUri(
    ctx.db,
    ctx.collection,
    ctx.sourceUri,
    ctx.targetUri,
  );

  if (!updateResult) {
    return { status: "error" };
  }

  console.log(`   Firestore: Updated ${updateResult.id}`);
  return { status: "updated", docId: updateResult.id };
}

// ============================================================================
// Migrate Mode
// ============================================================================

async function runMigrate(options: MigrateOptions): Promise<void> {
  const isDryRun = !options.force;

  console.log("\n=== MIGRATE MODE ===");
  console.log(`Source bucket: ${options.source}`);
  console.log(`Target bucket: ${options.target}`);
  console.log(`Source env: ${options.sourceEnv}`);
  console.log(`Target env: ${options.targetEnv}`);
  console.log(`Dry run: ${isDryRun}`);
  if (options.file) {
    console.log(`Single file: ${options.file}`);
  }

  const env = validateEnvironment();
  const { db, storage } = await initializeServices(env);
  const filesToMigrate = await getFilesToMigrate(storage, options);
  const { sourceCollection, targetCollection, isCrossEnv } =
    getCollectionConfig(options);

  console.log(`\nSource Firestore: ${sourceCollection}`);
  console.log(`Target Firestore: ${targetCollection}`);
  console.log(`Cross-environment transfer: ${isCrossEnv}`);

  const results: MigrateResult[] = [];

  for (const file of filesToMigrate) {
    const result = await migrateFile({
      file,
      options,
      env,
      db,
      storage,
      sourceCollection,
      targetCollection,
      isCrossEnv,
      isDryRun,
    });
    results.push(result);
  }

  printMigrateSummary(results, options.json, isDryRun);
}

async function getFilesToMigrate(
  storage: Storage,
  options: MigrateOptions,
): Promise<string[]> {
  // Validate bucket access
  console.log("\nValidating bucket access...");
  const sourceAccess = await validateBucketAccess(
    storage,
    options.source,
    "read",
  );
  if (!sourceAccess.success) {
    console.error(`ERROR: Cannot read source bucket: ${sourceAccess.error}`);
    process.exit(1);
  }

  if (!options.skipCopy) {
    const targetAccess = await validateBucketAccess(
      storage,
      options.target,
      "write",
    );
    if (!targetAccess.success) {
      console.error(
        `ERROR: Cannot write to target bucket: ${targetAccess.error}`,
      );
      process.exit(1);
    }
  }
  console.log("   Bucket access validated");

  if (options.file) {
    return [options.file];
  }

  console.log("\nListing files in source bucket...");
  const files = await listBucketReports(storage, options.source);
  console.log(`   Found ${files.length} files`);

  if (files.length > 100) {
    console.warn(`\nWARNING: Large bucket with ${files.length} files.`);
    console.warn(
      "   Consider using --file to migrate specific files, or run in batches.",
    );
  }

  return files;
}

function getCollectionConfig(options: MigrateOptions): {
  sourceCollection: string;
  targetCollection: string;
  isCrossEnv: boolean;
} {
  return {
    sourceCollection: getCollectionNameForEnv(
      envToFirestoreEnv(options.sourceEnv),
    ),
    targetCollection: getCollectionNameForEnv(
      envToFirestoreEnv(options.targetEnv),
    ),
    isCrossEnv: options.sourceEnv !== options.targetEnv,
  };
}

interface MigrateFileContext {
  file: string;
  options: MigrateOptions;
  env: Env;
  db: admin.firestore.Firestore;
  storage: Storage;
  sourceCollection: string;
  targetCollection: string;
  isCrossEnv: boolean;
  isDryRun: boolean;
}

async function migrateFile(ctx: MigrateFileContext): Promise<MigrateResult> {
  const sourceUri = buildGcsUri(ctx.options.source, ctx.file);
  const targetUri = buildGcsUri(ctx.options.target, ctx.file);

  const result: MigrateResult = {
    file: ctx.file,
    sourceUri,
    targetUri,
    copyResult: "skipped",
    firestoreResult: "not-found",
  };

  console.log(`\nProcessing: ${ctx.file}`);

  try {
    result.copyResult = await copyFileIfNeeded(
      {
        storage: ctx.storage,
        source: ctx.options.source,
        target: ctx.options.target,
        file: ctx.file,
        isDryRun: ctx.isDryRun,
      },
      ctx.options.skipCopy,
    );

    const firestoreResult = ctx.isCrossEnv
      ? await transferFirestoreRef({
          db: ctx.db,
          sourceCollection: ctx.sourceCollection,
          targetCollection: ctx.targetCollection,
          sourceUri,
          targetUri,
          ownerId: ctx.options.ownerId || ctx.env.LEGACY_REPORT_USER_ID,
          deleteSource: ctx.options.deleteSource,
          isDryRun: ctx.isDryRun,
        })
      : await updateFirestoreRef({
          db: ctx.db,
          collection: ctx.sourceCollection,
          sourceUri,
          targetUri,
          isDryRun: ctx.isDryRun,
        });

    result.firestoreResult = firestoreResult.status;
    result.newDocId = firestoreResult.docId;
  } catch (error) {
    result.copyResult = "error";
    result.firestoreResult = "error";
    result.error = error instanceof Error ? error.message : String(error);
    console.error(`   ERROR: ${result.error}`);
  }

  return result;
}

function printMigrateSummary(
  results: MigrateResult[],
  json: boolean,
  isDryRun: boolean,
): void {
  if (json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log("\n=== MIGRATION SUMMARY ===");
  console.log(`Total files: ${results.length}`);
  console.log(
    `Copied: ${results.filter((r) => r.copyResult === "copied").length}`,
  );
  console.log(
    `Skipped: ${results.filter((r) => r.copyResult === "skipped").length}`,
  );
  console.log(
    `Errors: ${results.filter((r) => r.copyResult === "error").length}`,
  );
  console.log(
    `Firestore updated: ${results.filter((r) => r.firestoreResult === "updated").length}`,
  );
  console.log(
    `Firestore transferred: ${results.filter((r) => r.firestoreResult === "transferred").length}`,
  );
  console.log(
    `Firestore not found: ${results.filter((r) => r.firestoreResult === "not-found").length}`,
  );

  if (isDryRun) {
    console.log("\nThis was a DRY RUN. To execute, add --force");
  }
}

// ============================================================================
// Verify Mode - Helper Functions
// ============================================================================

interface VerifyFileContext {
  storage: Storage;
  uri: string;
  fullValidation: boolean;
}

async function verifyFile(ctx: VerifyFileContext): Promise<VerifyResult> {
  const parsed = parseGcsUri(ctx.uri);
  if (!parsed) {
    return {
      file: ctx.uri,
      uri: ctx.uri,
      gcsExists: false,
      firestoreExists: true,
      error: "Invalid URI format",
    };
  }

  const result: VerifyResult = {
    file: parsed.fileName,
    uri: ctx.uri,
    gcsExists: false,
    firestoreExists: true,
  };

  console.log(`\nVerifying: ${parsed.fileName}`);

  const exists = await fileExists(ctx.storage, parsed.bucket, parsed.fileName);
  result.gcsExists = exists;
  console.log(`   GCS: ${exists ? "exists" : "MISSING"}`);

  if (ctx.fullValidation && exists) {
    await validateSchema(ctx.storage, parsed, result);
  }

  return result;
}

async function validateSchema(
  storage: Storage,
  parsed: { bucket: string; fileName: string },
  result: VerifyResult,
): Promise<void> {
  try {
    console.log("   Validating schema...");
    const content = await downloadFile(storage, parsed.bucket, parsed.fileName);
    const data = JSON.parse(content);
    schema.pipelineOutput.parse(data);
    result.schemaValid = true;
    console.log("   Schema: valid");
  } catch (error) {
    result.schemaValid = false;
    result.error = error instanceof Error ? error.message : String(error);
    console.log(`   Schema: INVALID - ${result.error}`);
  }
}

function printVerifySummary(
  results: VerifyResult[],
  json: boolean,
  fullValidation: boolean,
): void {
  if (json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log("\n=== VERIFICATION SUMMARY ===");
  console.log(`Total entries: ${results.length}`);
  console.log(`GCS exists: ${results.filter((r) => r.gcsExists).length}`);
  console.log(`GCS missing: ${results.filter((r) => !r.gcsExists).length}`);

  if (fullValidation) {
    console.log(
      `Schema valid: ${results.filter((r) => r.schemaValid === true).length}`,
    );
    console.log(
      `Schema invalid: ${results.filter((r) => r.schemaValid === false).length}`,
    );
  }

  const problems = results.filter(
    (r) => !r.gcsExists || r.schemaValid === false,
  );
  if (problems.length > 0) {
    printVerifyProblems(problems);
  } else {
    console.log("\nAll reports verified successfully!");
  }
}

function printVerifyProblems(problems: VerifyResult[]): void {
  console.log("\nProblems found:");
  for (const p of problems) {
    const issues: string[] = [];
    if (!p.gcsExists) issues.push("missing from GCS");
    if (p.schemaValid === false) issues.push("invalid schema");
    console.log(`  - ${p.file}: ${issues.join(", ")}`);
  }
}

// ============================================================================
// Verify Mode
// ============================================================================

async function runVerify(options: VerifyOptions): Promise<void> {
  console.log("\n=== VERIFY MODE ===");
  console.log(`Bucket: ${options.bucket}`);
  console.log(`Environment: ${options.env}`);
  console.log(`Full validation: ${options.full}`);

  const env = validateEnvironment();
  const { db, storage } = await initializeServices(env);

  const collectionName = getCollectionNameForEnv(
    envToFirestoreEnv(options.env),
  );

  console.log(`\nQuerying Firestore: ${collectionName}`);
  const firestoreRefs = await findReportRefsForBucket(
    db,
    options.bucket,
    collectionName,
  );
  console.log(`   Found ${firestoreRefs.length} entries`);

  const results: VerifyResult[] = [];

  for (const ref of firestoreRefs) {
    const result = await verifyFile({
      storage,
      uri: ref.data.reportDataUri,
      fullValidation: options.full,
    });
    results.push(result);
  }

  printVerifySummary(results, options.json, options.full);
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function showHelp(): void {
  console.log(`
Report Tool - Manage reports across GCS buckets and Firestore environments

Usage:
  pnpm -F utils report -- <command> [options]

Commands:
  audit     Discover reports in a bucket and cross-reference with Firestore
  migrate   Copy files between buckets and transfer Firestore records
  verify    Check that reports are accessible after migration

Audit Options:
  --bucket <name>       Bucket to audit (required)
  --env <dev|prod>      Firestore environment (default: dev)
  --json                Output JSON format

Migrate Options:
  --source <bucket>     Source bucket (required)
  --target <bucket>     Target bucket (required)
  --source-env <env>    Source Firestore env: dev or prod (default: dev)
  --target-env <env>    Target Firestore env: dev or prod (default: same as source-env)
  --file <name>         Migrate single file only
  --force               Execute changes (default: dry-run)
  --skip-copy           Only update Firestore, don't copy files
  --owner-id <uid>      Owner for transferred refs (default: LEGACY_REPORT_USER_ID)
  --delete-source       Delete source Firestore entry after transfer
  --json                Output JSON format

Verify Options:
  --bucket <name>       Bucket to verify (required)
  --env <dev|prod>      Firestore environment (default: dev)
  --full                Download and validate JSON schema
  --json                Output JSON format

Examples:
  # Audit a bucket
  pnpm -F utils report -- audit --bucket tttc-light-newbucket --env prod

  # Dry-run migration (preview)
  pnpm -F utils report -- migrate --source old-bucket --target new-bucket

  # Execute migration within same environment
  pnpm -F utils report -- migrate --source old-bucket --target new-bucket --source-env prod --force

  # Cross-environment transfer (dev to prod)
  pnpm -F utils report -- migrate --source dev-bucket --target prod-bucket \\
    --source-env dev --target-env prod --force

  # Verify reports in a bucket
  pnpm -F utils report -- verify --bucket tttc-light-prod --env prod --full
`);
}

function parseArgs(): {
  command: string;
  options: Record<string, string | boolean>;
} {
  // Filter out standalone '--' that pnpm adds
  const args = process.argv.slice(2).filter((arg) => arg !== "--");

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showHelp();
    process.exit(0);
  }

  const command = args[0];
  const options: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith("--")) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    }
  }

  return { command, options };
}

// ============================================================================
// Main
// ============================================================================

/**
 * Validate that an env value is valid
 */
function validateEnvValue(
  value: string | undefined,
  flagName: string,
): FirestoreEnv {
  if (!value) {
    return "dev"; // Default
  }
  if (value !== "dev" && value !== "prod") {
    console.error(`ERROR: Invalid value for ${flagName}: "${value}"`);
    console.error('  Valid values are: "dev" or "prod"');
    process.exit(1);
  }
  return value;
}

/**
 * Validate Firebase UID format
 * Firebase UIDs are typically 28 characters, alphanumeric
 */
function validateOwnerId(ownerId: string | undefined): string | undefined {
  if (!ownerId) {
    return undefined;
  }
  const uidPattern = /^[a-zA-Z0-9]{20,128}$/;
  if (!uidPattern.test(ownerId)) {
    console.error(`ERROR: Invalid owner ID format: "${ownerId}"`);
    console.error(
      "  Owner ID must be a valid Firebase UID (alphanumeric, 20-128 chars)",
    );
    process.exit(1);
  }
  return ownerId;
}

function buildAuditOptions(
  options: Record<string, string | boolean>,
): AuditOptions {
  if (!options.bucket) {
    console.error("ERROR: --bucket is required for audit");
    process.exit(1);
  }
  return {
    bucket: options.bucket as string,
    env: validateEnvValue(options.env as string | undefined, "--env"),
    json: options.json === true,
  };
}

function buildMigrateOptions(
  options: Record<string, string | boolean>,
): MigrateOptions {
  if (!options.source) {
    console.error("ERROR: --source is required for migrate");
    process.exit(1);
  }
  if (!options.target) {
    console.error("ERROR: --target is required for migrate");
    process.exit(1);
  }

  const sourceEnv = validateEnvValue(
    options["source-env"] as string | undefined,
    "--source-env",
  );
  const targetEnv = options["target-env"]
    ? validateEnvValue(options["target-env"] as string, "--target-env")
    : sourceEnv;

  if (options.source === options.target) {
    console.warn(
      "WARNING: Source and target buckets are the same. Only Firestore references will be updated.",
    );
  }

  return {
    source: options.source as string,
    target: options.target as string,
    sourceEnv,
    targetEnv,
    file: options.file as string | undefined,
    force: options.force === true,
    skipCopy: options["skip-copy"] === true,
    ownerId: validateOwnerId(options["owner-id"] as string | undefined),
    json: options.json === true,
    deleteSource: options["delete-source"] === true,
  };
}

function buildVerifyOptions(
  options: Record<string, string | boolean>,
): VerifyOptions {
  if (!options.bucket) {
    console.error("ERROR: --bucket is required for verify");
    process.exit(1);
  }
  return {
    bucket: options.bucket as string,
    env: validateEnvValue(options.env as string | undefined, "--env"),
    full: options.full === true,
    json: options.json === true,
  };
}

async function main(): Promise<void> {
  const { command, options } = parseArgs();

  switch (command) {
    case "audit":
      await runAudit(buildAuditOptions(options));
      break;
    case "migrate":
      await runMigrate(buildMigrateOptions(options));
      break;
    case "verify":
      await runVerify(buildVerifyOptions(options));
      break;
    default:
      console.error(`ERROR: Unknown command: ${command}`);
      console.error("Run with --help for usage information");
      process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nFATAL ERROR:", error);
    process.exit(1);
  });
