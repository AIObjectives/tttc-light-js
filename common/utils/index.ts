import { SourceRow } from "../schema";

export function assertNever(x: never): never {
  throw new Error("Unexpected object: " + JSON.stringify(x));
}

/**
 * Formats raw CSV data with flexible column name mapping
 * Supports multiple CSV formats (WhatsApp, standard T3C, etc.)
 * @param data - Raw parsed CSV data with any column names
 * @returns Formatted data conforming to SourceRow schema
 */
export function formatData(data: Record<string, unknown>[]): SourceRow[] {
  // Flexible column name mapping for different CSV formats
  // Note: Column precedence is determined by array order - first match wins
  // Comparison is case-insensitive
  const ID_COLS = ["id", "comment-id", "row-id", "i"];
  const COMMENT_COLS = [
    "comment",
    "comment-body",
    "response",
    "answer",
    "text",
  ];
  const INTERVIEW_COLS = [
    "interview",
    "name",
    "extraquestion1", // WhatsApp format alternate name column
    "speaker name",
    "speaker-name",
    "author",
    "speaker-id",
    "speaker_id",
  ];

  if (!data || !data.length) {
    throw Error("Invalid or empty data file");
  }
  const keys = Object.keys(data[0]);
  const lowerKeys = new Map(keys.map((k) => [k.toLowerCase(), k]));

  const id_column = ID_COLS.map((col) => lowerKeys.get(col.toLowerCase())).find(
    (matchedKey) => matchedKey,
  );
  const comment_column = COMMENT_COLS.map((col) =>
    lowerKeys.get(col.toLowerCase()),
  ).find((matchedKey) => matchedKey);
  const interview_column = INTERVIEW_COLS.map((col) =>
    lowerKeys.get(col.toLowerCase()),
  ).find((matchedKey) => matchedKey);

  if (!comment_column) {
    throw Error(
      `The csv file must contain a comment column (valid column names: ${COMMENT_COLS.join(", ")})`,
    );
  }
  return data.map((row, index: number): SourceRow => {
    // Use row index as fallback ID when no ID column exists
    // This ensures every row has a unique identifier
    const id = id_column ? String(row[id_column]) : String(index);
    const comment = String(row[comment_column]);
    const res: SourceRow = { id, comment };
    if (lowerKeys.has("video")) {
      res.video = String(row[lowerKeys.get("video")!]);
    }
    // Use flexible interview column mapping
    if (interview_column) {
      res.interview = String(row[interview_column]);
    }
    if (lowerKeys.has("timestamp")) {
      res.timestamp = String(row[lowerKeys.get("timestamp")!]);
    }
    return res;
  });
}

/**
 * Firestore auto-generated IDs are exactly 20 characters long
 * and contain only alphanumeric characters
 */
export const FIRESTORE_ID_REGEX = /^[A-Za-z0-9]{20}$/;

/**
 * Validates that a report URI is safe for processing
 * Prevents malicious URLs like javascript:, data:, file:, etc.
 */
export function isValidReportUri(uri: string): boolean {
  if (!uri || typeof uri !== "string") {
    return false;
  }

  const trimmedUri = uri.trim();

  // Reject empty strings
  if (trimmedUri === "") {
    return false;
  }

  // Allow valid HTTPS URLs from trusted domains and legacy bucket-style paths
  try {
    // If it parses as URL, must be HTTPS and from trusted domains
    const url = new URL(trimmedUri);
    if (url.protocol !== "https:") {
      return false;
    }

    // Allow Google Cloud Storage URLs
    const trustedHosts = ["storage.googleapis.com", "storage.cloud.google.com"];
    return trustedHosts.includes(url.hostname);
  } catch {
    // If not a valid URL, treat as legacy bucket/path format
    // Allow alphanumeric, hyphens, underscores, dots, slashes
    return /^[a-zA-Z0-9._/-]+$/.test(trimmedUri);
  }
}

/**
 * Converts a GCS URL to legacy report URI format
 * @param gcsUrl - Full GCS URL like "https://storage.googleapis.com/bucket/path/file.json"
 * @returns Legacy URI format like "bucket/path/file.json"
 */
export function getLegacyReportUri(gcsUrl: string): string {
  try {
    const url = new URL(gcsUrl);
    if (url.hostname === "storage.googleapis.com") {
      // Remove leading slash and return bucket/path format
      return url.pathname.slice(1);
    }
    // If not a GCS URL, return as-is (might already be in legacy format)
    return gcsUrl;
  } catch {
    // If URL parsing fails, return as-is
    return gcsUrl;
  }
}
