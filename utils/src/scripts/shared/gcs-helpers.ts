/**
 * Shared GCS utilities for report management scripts
 *
 * Provides common functionality for listing, copying, and validating
 * files in Google Cloud Storage buckets.
 */

import type { File, Storage } from "@google-cloud/storage";

/**
 * List all JSON report files in a bucket
 *
 * Note: This fetches all files without pagination. For buckets with
 * thousands of files, consider adding pagination support. Report buckets
 * typically have dozens to hundreds of files, so this is acceptable.
 */
export async function listBucketReports(
  storage: Storage,
  bucketName: string,
): Promise<string[]> {
  const [files] = await storage.bucket(bucketName).getFiles();

  return files
    .filter((file: File) => file.name.endsWith(".json"))
    .map((file: File) => file.name);
}

/**
 * Copy a file between buckets with verification
 */
export async function copyFileBetweenBuckets(
  storage: Storage,
  source: { bucket: string; file: string },
  target: { bucket: string; file: string },
): Promise<{ success: boolean; size: number }> {
  const sourceBucket = storage.bucket(source.bucket);
  const sourceFile = sourceBucket.file(source.file);
  const targetBucket = storage.bucket(target.bucket);
  const targetFile = targetBucket.file(target.file);

  // Get source file metadata
  const [sourceMetadata] = await sourceFile.getMetadata();
  const sourceSize = Number(sourceMetadata.size);

  // Copy file
  await sourceFile.copy(targetFile);

  // Verify copy
  const [targetMetadata] = await targetFile.getMetadata();
  const targetSize = Number(targetMetadata.size);

  return {
    success: sourceSize === targetSize,
    size: targetSize,
  };
}

/**
 * Check if a file exists in a bucket
 */
export async function fileExists(
  storage: Storage,
  bucketName: string,
  fileName: string,
): Promise<boolean> {
  const [exists] = await storage.bucket(bucketName).file(fileName).exists();
  return exists;
}

/**
 * Validate access to a bucket
 */
export async function validateBucketAccess(
  storage: Storage,
  bucketName: string,
  operation: "read" | "write",
): Promise<{ success: boolean; error?: string }> {
  try {
    const bucket = storage.bucket(bucketName);

    if (operation === "read") {
      // Try to list files (limited to 1 for speed)
      await bucket.getFiles({ maxResults: 1 });
    } else {
      // Write test: create and delete a temp file
      const testFileName = `.migration-test-${Date.now()}`;
      const testFile = bucket.file(testFileName);
      await testFile.save("test");
      await testFile.delete();
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Build a full GCS URI from bucket and filename
 */
export function buildGcsUri(bucket: string, fileName: string): string {
  return `https://storage.googleapis.com/${bucket}/${fileName}`;
}

/**
 * Parse a GCS URI into bucket and fileName
 */
export function parseGcsUri(
  uri: string,
): { bucket: string; fileName: string } | null {
  // Try URL-encoded format from browser URL bar first
  const encodedMatch = uri.match(/\/report\/(https%3A%2F%2F[^?#]+)/);
  if (encodedMatch) {
    const decodedUri = decodeURIComponent(encodedMatch[1]);
    return parseGcsUri(decodedUri);
  }

  // Try full URL format
  const urlMatch = uri.match(
    /https:\/\/storage\.googleapis\.com\/([^/]+)\/(.+)/,
  );
  if (urlMatch) {
    return { bucket: urlMatch[1], fileName: urlMatch[2] };
  }

  // Try bucket/file format
  const pathMatch = uri.match(/^([^/]+)\/(.+)$/);
  if (pathMatch) {
    return { bucket: pathMatch[1], fileName: pathMatch[2] };
  }

  return null;
}

/**
 * Download a file from GCS and return its contents as a string
 */
export async function downloadFile(
  storage: Storage,
  bucketName: string,
  fileName: string,
): Promise<string> {
  const [content] = await storage.bucket(bucketName).file(fileName).download();
  return content.toString();
}
