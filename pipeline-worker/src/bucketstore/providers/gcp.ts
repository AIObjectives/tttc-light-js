import { Storage } from "@google-cloud/storage";
import { formatError } from "tttc-common/utils";
import {
  type BucketStore,
  DeleteFailedError,
  type FileExistsResult,
  UploadFailedError,
} from "../types";

/**
 * Type guard to check if an error is a GCS ApiError with a code property
 */
interface ApiError extends Error {
  code?: number;
  errors?: unknown[];
}

/**
 * Type guard for ApiError
 */
function isApiError(error: unknown): error is ApiError {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof (error as ApiError).code === "number"
  );
}

/**
 * Categorize storage error based on HTTP status codes and error patterns.
 * Prefers structured error codes from ApiError over string matching.
 */
function categorizeStorageError(
  error: unknown,
): "permission" | "transient" | "not_found" | "permanent" {
  // First try to get the HTTP status code from ApiError
  if (isApiError(error) && error.code !== undefined) {
    const code = error.code;

    // Permission errors (403, 401)
    if (code === 403 || code === 401) {
      return "permission";
    }

    // Not found errors (404, 410 Gone)
    if (code === 404 || code === 410) {
      return "not_found";
    }

    // Transient errors that can be retried
    if (
      code === 429 || // Too Many Requests
      code === 503 || // Service Unavailable
      code === 504 || // Gateway Timeout
      code === 408 || // Request Timeout
      (code >= 500 && code < 600) // Other 5xx errors
    ) {
      return "transient";
    }

    // 4xx client errors (except those handled above) are permanent
    if (code >= 400 && code < 500) {
      return "permanent";
    }
  }

  // Fallback to string matching for non-ApiError cases
  const errorMessage = formatError(error);

  // Check for permission errors
  if (
    errorMessage.includes("403") ||
    errorMessage.includes("401") ||
    errorMessage.toLowerCase().includes("permission") ||
    errorMessage.toLowerCase().includes("access denied") ||
    errorMessage.toLowerCase().includes("unauthorized")
  ) {
    return "permission";
  }

  // Check for not found errors
  if (
    errorMessage.includes("404") ||
    errorMessage.includes("410") ||
    errorMessage.toLowerCase().includes("not found") ||
    errorMessage.toLowerCase().includes("no such object")
  ) {
    return "not_found";
  }

  // Check for transient errors
  if (
    errorMessage.includes("timeout") ||
    errorMessage.includes("ETIMEDOUT") ||
    errorMessage.includes("ECONNREFUSED") ||
    errorMessage.includes("ECONNRESET") ||
    errorMessage.includes("503") ||
    errorMessage.includes("504") ||
    errorMessage.includes("429")
  ) {
    return "transient";
  }

  // Unknown errors default to permanent to avoid infinite retries
  return "permanent";
}

/**
 * GCP Cloud Storage implementation of the BucketStore interface.
 *
 * This implementation uses Google Cloud Storage to store files.
 *
 * Authentication is handled via:
 * - GOOGLE_APPLICATION_CREDENTIALS environment variable pointing to a service account key file
 * - Application Default Credentials (ADC) when running in GCP environments
 */
export class GCPBucketStore implements BucketStore {
  private storage: Storage;
  private bucketName: string;

  /**
   * Creates a new GCPBucketStore instance.
   *
   * @param bucketName - The name of the GCS bucket to use for storing files
   * @param projectId - Optional GCP project ID. If not provided, uses the default from credentials.
   */
  constructor(bucketName: string, projectId?: string) {
    this.bucketName = bucketName;
    this.storage = new Storage(projectId ? { projectId } : {});
  }

  async storeFile(
    fileName: string,
    fileContent: string,
    contentType = "application/json",
  ): Promise<string> {
    try {
      const bucketRef = this.storage.bucket(this.bucketName);

      // Use temporary filename to prevent serving corrupted files on partial upload
      const tempFileName = `${fileName}.tmp.${Date.now()}`;
      const tempFile = bucketRef.file(tempFileName);
      const finalFile = bucketRef.file(fileName);

      // Save to temporary file first
      await tempFile.save(fileContent, {
        metadata: {
          contentType,
        },
      });

      // Verify upload integrity BEFORE making file public
      // This prevents serving corrupted files during the verification window
      const expectedSize = Buffer.byteLength(fileContent, "utf8");
      const [tempMetadata] = await tempFile.getMetadata();

      if (tempMetadata.size !== undefined) {
        const uploadedSize = Number(tempMetadata.size);
        if (uploadedSize !== expectedSize) {
          // Clean up corrupted temp file
          await tempFile.delete();
          throw new Error(
            `Upload verification failed: expected ${expectedSize} bytes, got ${uploadedSize} bytes`,
          );
        }
      }

      // Atomically rename to final filename (overwrites existing file if present)
      // This ensures that either the complete, verified file is available or no file exists
      await tempFile.move(finalFile);

      // Generate the public URL for the file
      const url = `https://storage.googleapis.com/${this.bucketName}/${fileName}`;

      return url;
    } catch (error) {
      throw new UploadFailedError(fileName, formatError(error));
    }
  }

  async fileExists(fileName: string): Promise<FileExistsResult> {
    try {
      const bucketRef = this.storage.bucket(this.bucketName);
      const file = bucketRef.file(fileName);
      const [exists] = await file.exists();
      return exists ? { exists: true } : { exists: false };
    } catch (error) {
      const errorMessage = formatError(error);
      const wrappedError = new Error(
        `Failed to check file existence: ${errorMessage}`,
      );

      // Categorize the error type based on error object (prefers structured codes)
      const errorType = categorizeStorageError(error);

      return {
        exists: false,
        error: wrappedError,
        errorType,
      };
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      const bucketRef = this.storage.bucket(this.bucketName);
      const file = bucketRef.file(fileName);
      await file.delete();
    } catch (error) {
      const errorType = categorizeStorageError(error);
      throw new DeleteFailedError(fileName, formatError(error), errorType);
    }
  }

  async healthCheck(): Promise<void> {
    try {
      const bucketRef = this.storage.bucket(this.bucketName);
      // Verify bucket exists and we have access by checking if it exists
      const [exists] = await bucketRef.exists();

      if (!exists) {
        throw new Error(`Bucket ${this.bucketName} does not exist`);
      }

      // Verify we have permissions by attempting to get metadata
      await bucketRef.getMetadata();
    } catch (error) {
      const errorType = categorizeStorageError(error);

      if (errorType === "permission") {
        throw new Error(
          `Access denied to bucket ${this.bucketName}: ${formatError(error)}`,
        );
      }

      if (errorType === "not_found") {
        throw new Error(
          `Bucket ${this.bucketName} not found: ${formatError(error)}`,
        );
      }

      throw new Error(
        `GCS health check failed for bucket ${this.bucketName}: ${formatError(error)}`,
      );
    }
  }
}
