#!/usr/bin/env tsx
/**
 * Firestore Debug CLI Tool
 *
 * General-purpose Firestore CLI for exploring and debugging Firebase data.
 * Optimized for Claude Code consumption (JSON output by default).
 *
 * Usage:
 *   pnpm -F utils firestore <command> [args] [options]
 *
 * Commands:
 *   report <id>              Report lookup with GCS check & format detection
 *   download <id>            Download report JSON from GCS
 *   doc <collection> <id>    Get any document by collection/id
 *   user <id>                User document lookup
 *   job <id>                 Report job lookup
 *   list <collection>        List recent documents in a collection
 *
 * Options:
 *   --env prod|dev           Target environment (default: dev)
 *   --pretty                 Human-readable output instead of JSON
 *   --out <path>             Save download to file instead of stdout
 *   --limit N                Limit results for list command (default: 10)
 *
 * Exit codes:
 *   0 = success
 *   1 = not found
 *   2 = error
 *
 * Prerequisites:
 *   - FIREBASE_CREDENTIALS_ENCODED in express-server/.env
 *   - GOOGLE_CREDENTIALS_ENCODED in express-server/.env (for GCS operations)
 */

import * as fs from "node:fs";
import { basename, resolve } from "node:path";
import { Storage } from "@google-cloud/storage";
import * as dotenv from "dotenv";
import * as admin from "firebase-admin";
import { FIRESTORE_ID_REGEX } from "tttc-common/utils";
import { z } from "zod";
import { downloadFile, fileExists, parseGcsUri } from "./shared/gcs-helpers";

// Load environment from express-server/.env
const envPath = resolve(process.cwd(), "../express-server/.env");
dotenv.config({ path: envPath });

// Lighter env schema - no LEGACY_REPORT_USER_ID required for read-only operations
const envSchema = z.object({
  FIREBASE_CREDENTIALS_ENCODED: z.string().min(1),
  GOOGLE_CREDENTIALS_ENCODED: z.string().min(1),
});

type Env = z.infer<typeof envSchema>;

// Collection names
const COLLECTIONS = {
  REPORT_REF: "reportRef",
  REPORT_JOB: "reportJob",
  USERS: "users",
  FEEDBACK: "feedback",
} as const;

type CollectionKey = keyof typeof COLLECTIONS;

// Export for testing
export { COLLECTIONS, type CollectionKey };

// Output types
interface SuccessOutput {
  success: true;
  collection?: string;
  docId?: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface ErrorOutput {
  success: false;
  error: string;
  collection?: string;
  docId?: string;
}

interface ListOutput {
  success: true;
  collection: string;
  count: number;
  documents: Array<{ id: string; data: Record<string, unknown> }>;
}

interface DownloadOutput {
  success: true;
  reportId: string;
  gcsUri: string;
  content?: Record<string, unknown>;
  savedTo?: string;
  bytes?: number;
}

type Output = SuccessOutput | ErrorOutput | ListOutput | DownloadOutput;

// CLI options
interface Options {
  env: "prod" | "dev";
  pretty: boolean;
  out?: string;
  limit: number;
}

// Context passed to command handlers
interface CommandContext {
  db: admin.firestore.Firestore;
  storage: Storage;
  options: Options;
}

export function getCollectionName(
  key: CollectionKey,
  env: "prod" | "dev",
): string {
  const base = COLLECTIONS[key];
  return env === "prod" ? base : `${base}_dev`;
}

function output(data: Output, pretty: boolean): void {
  const indent = pretty ? 2 : undefined;
  console.log(JSON.stringify(data, null, indent));
}

function exitWithError(error: string, extra?: Partial<ErrorOutput>): never {
  output({ success: false, error, ...extra }, false);
  process.exit(2);
}

function exitNotFound(message: string, extra?: Partial<ErrorOutput>): never {
  output({ success: false, error: message, ...extra }, false);
  process.exit(1);
}

/**
 * Check if value is a Firestore Timestamp
 */
function isTimestamp(value: unknown): value is admin.firestore.Timestamp {
  return value instanceof admin.firestore.Timestamp;
}

/**
 * Check if value is a non-array object
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Convert a single value, handling Timestamps and nested structures
 */
function convertValue(value: unknown): unknown {
  if (isTimestamp(value)) {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(convertValue);
  }
  if (isPlainObject(value)) {
    return convertTimestamps(value);
  }
  return value;
}

/**
 * Convert Firestore Timestamps to ISO strings recursively
 */
export function convertTimestamps(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = convertValue(value);
  }
  return result;
}

/**
 * Detect URL format (legacy vs id:v1)
 */
export function getUrlFormat(
  reportDataUri: string | undefined,
): "legacy" | "id:v1" {
  if (!reportDataUri) return "legacy";
  const filename = reportDataUri.split("/").pop()?.replace(".json", "");
  return filename && FIRESTORE_ID_REGEX.test(filename) ? "id:v1" : "legacy";
}

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase(env: Env): {
  db: admin.firestore.Firestore;
  storage: Storage;
} {
  const firebaseCredentials = JSON.parse(
    Buffer.from(env.FIREBASE_CREDENTIALS_ENCODED, "base64").toString("utf-8"),
  );

  const googleCredentials = JSON.parse(
    Buffer.from(env.GOOGLE_CREDENTIALS_ENCODED, "base64").toString("utf-8"),
  );

  const app = admin.apps.length
    ? admin.app()
    : admin.initializeApp({
        credential: admin.credential.cert(firebaseCredentials),
      });

  const db = admin.firestore(app);
  const storage = new Storage({ credentials: googleCredentials });

  return { db, storage };
}

/**
 * Resolve collection name with environment suffix
 */
function resolveCollectionName(
  collectionName: string,
  env: "prod" | "dev",
): string {
  const knownKey = Object.entries(COLLECTIONS).find(
    ([, v]) => v === collectionName,
  )?.[0] as CollectionKey | undefined;

  if (knownKey) {
    return getCollectionName(knownKey, env);
  }
  if (env === "dev" && !collectionName.endsWith("_dev")) {
    return `${collectionName}_dev`;
  }
  return collectionName;
}

/**
 * Generic document lookup - reduces duplication between user/job commands
 */
async function lookupDocument(
  collectionKey: CollectionKey,
  id: string,
  notFoundMessage: string,
  ctx: CommandContext,
): Promise<void> {
  const collection = getCollectionName(collectionKey, ctx.options.env);
  const doc = await ctx.db.collection(collection).doc(id).get();

  if (!doc.exists) {
    exitNotFound(notFoundMessage, { collection, docId: id });
  }

  const data = convertTimestamps(doc.data() as Record<string, unknown>);
  output({ success: true, collection, docId: id, data }, ctx.options.pretty);
}

/**
 * Command: report <id>
 * Report lookup with GCS check and format detection
 */
async function commandReport(
  args: string[],
  ctx: CommandContext,
): Promise<void> {
  if (!args[0]) {
    exitWithError("Usage: firestore report <id>");
  }
  const id = args[0];
  const collection = getCollectionName("REPORT_REF", ctx.options.env);
  const doc = await ctx.db.collection(collection).doc(id).get();

  if (!doc.exists) {
    exitNotFound("Document not found", { collection, docId: id });
  }

  const data = convertTimestamps(doc.data() as Record<string, unknown>);
  const reportDataUri = data.reportDataUri as string | undefined;

  // Check GCS existence
  let gcsExists = false;
  if (reportDataUri) {
    const parsed = parseGcsUri(reportDataUri);
    if (parsed) {
      try {
        gcsExists = await fileExists(
          ctx.storage,
          parsed.bucket,
          parsed.fileName,
        );
      } catch {
        // GCS check failed, leave as false
      }
    }
  }

  output(
    {
      success: true,
      collection,
      docId: id,
      data,
      metadata: { gcsExists, urlFormat: getUrlFormat(reportDataUri) },
    },
    ctx.options.pretty,
  );
}

/**
 * Command: download <id>
 * Download report JSON from GCS
 */
async function commandDownload(
  args: string[],
  ctx: CommandContext,
): Promise<void> {
  if (!args[0]) {
    exitWithError("Usage: firestore download <id>");
  }
  const id = args[0];
  const collection = getCollectionName("REPORT_REF", ctx.options.env);
  const doc = await ctx.db.collection(collection).doc(id).get();

  if (!doc.exists) {
    exitNotFound("Document not found", { collection, docId: id });
  }

  const data = doc.data() as Record<string, unknown>;
  const reportDataUri = data.reportDataUri as string | undefined;

  if (!reportDataUri) {
    exitWithError("No reportDataUri in document", { collection, docId: id });
  }

  const parsed = parseGcsUri(reportDataUri);
  if (!parsed) {
    exitWithError(`Invalid GCS URI: ${reportDataUri}`, {
      collection,
      docId: id,
    });
  }

  let content: string;
  try {
    content = await downloadFile(ctx.storage, parsed.bucket, parsed.fileName);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    exitWithError(`Failed to download from GCS: ${message}`, {
      collection,
      docId: id,
    });
  }

  if (ctx.options.out) {
    fs.writeFileSync(ctx.options.out, content);
    output(
      {
        success: true,
        reportId: id,
        gcsUri: reportDataUri,
        savedTo: ctx.options.out,
        bytes: Buffer.byteLength(content),
      },
      ctx.options.pretty,
    );
  } else {
    let parsedContent: Record<string, unknown>;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      exitWithError("GCS content is not valid JSON");
    }
    output(
      {
        success: true,
        reportId: id,
        gcsUri: reportDataUri,
        content: parsedContent,
      },
      ctx.options.pretty,
    );
  }
}

/**
 * Command: doc <collection> <id>
 * Get any document by collection/id
 */
async function commandDoc(args: string[], ctx: CommandContext): Promise<void> {
  if (!args[0] || !args[1]) {
    exitWithError("Usage: firestore doc <collection> <id>");
  }
  const [collectionName, id] = args;
  const finalCollection = resolveCollectionName(
    collectionName,
    ctx.options.env,
  );
  const doc = await ctx.db.collection(finalCollection).doc(id).get();

  if (!doc.exists) {
    exitNotFound("Document not found", {
      collection: finalCollection,
      docId: id,
    });
  }

  const data = convertTimestamps(doc.data() as Record<string, unknown>);
  output(
    { success: true, collection: finalCollection, docId: id, data },
    ctx.options.pretty,
  );
}

/**
 * Command: user <id>
 * User document lookup
 */
async function commandUser(args: string[], ctx: CommandContext): Promise<void> {
  if (!args[0]) {
    exitWithError("Usage: firestore user <id>");
  }
  await lookupDocument("USERS", args[0], "User not found", ctx);
}

/**
 * Command: job <id>
 * Report job lookup
 */
async function commandJob(args: string[], ctx: CommandContext): Promise<void> {
  if (!args[0]) {
    exitWithError("Usage: firestore job <id>");
  }
  await lookupDocument("REPORT_JOB", args[0], "Job not found", ctx);
}

/**
 * Command: list <collection>
 * List recent documents in a collection
 */
async function commandList(args: string[], ctx: CommandContext): Promise<void> {
  if (!args[0]) {
    exitWithError("Usage: firestore list <collection>");
  }
  const finalCollection = resolveCollectionName(args[0], ctx.options.env);

  // Try ordering by common date fields, fall back to unordered if none exist.
  // Firestore throws errors for missing indexes on orderBy queries.
  // The fallback query (no orderBy) is NOT in try/catch, so real errors
  // (network, permissions) will propagate correctly.
  const orderFields = ["createdDate", "createdAt", "created"];
  let snapshot: admin.firestore.QuerySnapshot | null = null;

  for (const field of orderFields) {
    try {
      snapshot = await ctx.db
        .collection(finalCollection)
        .orderBy(field, "desc")
        .limit(ctx.options.limit)
        .get();
      break;
    } catch {
      // Index error or field doesn't exist - try next field
    }
  }

  // Fallback: unordered query (real errors will propagate here)
  if (!snapshot) {
    snapshot = await ctx.db
      .collection(finalCollection)
      .limit(ctx.options.limit)
      .get();
  }

  const documents = snapshot.docs.map((doc) => ({
    id: doc.id,
    data: convertTimestamps(doc.data() as Record<string, unknown>),
  }));

  output(
    {
      success: true,
      collection: finalCollection,
      count: documents.length,
      documents,
    },
    ctx.options.pretty,
  );
}

// Command registry - maps command names to handlers
type CommandHandler = (args: string[], ctx: CommandContext) => Promise<void>;

const COMMANDS: Record<string, CommandHandler> = {
  report: commandReport,
  download: commandDownload,
  doc: commandDoc,
  user: commandUser,
  job: commandJob,
  list: commandList,
};

// Option definitions for declarative parsing
interface OptionDef {
  flag: string;
  hasValue: boolean;
  parse: (value: string | undefined, options: Options) => void;
}

const OPTION_DEFS: OptionDef[] = [
  {
    flag: "--env",
    hasValue: true,
    parse: (value, opts) => {
      if (value === "prod" || value === "dev") opts.env = value;
    },
  },
  {
    flag: "--pretty",
    hasValue: false,
    parse: (_, opts) => {
      opts.pretty = true;
    },
  },
  {
    flag: "--out",
    hasValue: true,
    parse: (value, opts) => {
      if (value) opts.out = value;
    },
  },
  {
    flag: "--limit",
    hasValue: true,
    parse: (value, opts) => {
      if (value) opts.limit = Number.parseInt(value, 10) || 10;
    },
  },
];

/**
 * Parse CLI arguments using declarative option definitions
 */
function parseArgs(): { command: string; args: string[]; options: Options } {
  const argv = process.argv.slice(2);
  const options: Options = { env: "dev", pretty: false, limit: 10 };
  const args: string[] = [];
  let command = "";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const optDef = OPTION_DEFS.find((o) => o.flag === arg);

    if (optDef) {
      const value = optDef.hasValue ? argv[++i] : undefined;
      optDef.parse(value, options);
    } else if (!command) {
      command = arg;
    } else {
      args.push(arg);
    }
  }

  return { command, args, options };
}

const HELP_TEXT = `
Firestore Debug CLI Tool

Usage:
  pnpm -F utils firestore <command> [args] [options]

Commands:
  report <id>              Report lookup with GCS check & format detection
  download <id>            Download report JSON from GCS
  doc <collection> <id>    Get any document by collection/id
  user <id>                User document lookup
  job <id>                 Report job lookup
  list <collection>        List recent documents in a collection

Options:
  --env prod|dev           Target environment (default: dev)
  --pretty                 Human-readable output instead of JSON
  --out <path>             Save download to file instead of stdout
  --limit N                Limit results for list command (default: 10)

Exit codes:
  0 = success
  1 = not found
  2 = error
`;

async function main(): Promise<void> {
  const { command, args, options } = parseArgs();

  if (!command || command === "help" || command === "--help") {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const handler = COMMANDS[command];
  if (!handler) {
    exitWithError(`Unknown command: ${command}`);
  }

  const envResult = envSchema.safeParse(process.env);
  if (!envResult.success) {
    exitWithError(
      "Missing environment variables. Ensure FIREBASE_CREDENTIALS_ENCODED and GOOGLE_CREDENTIALS_ENCODED are set in express-server/.env",
    );
  }

  const { db, storage } = initializeFirebase(envResult.data);
  const ctx: CommandContext = { db, storage, options };

  try {
    await handler(args, ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    exitWithError(message);
  }

  process.exit(0);
}

// Only run main when executed directly (not when imported for testing)
// Use basename for exact match to avoid false positives from other *firestore.ts files
if (basename(process.argv[1] ?? "") === "firestore.ts") {
  main();
}
