import { Storage } from "@google-cloud/storage";
import { formatError } from "tttc-common/utils";
import {
  type BucketStore,
  type FileExistsResult,
  UploadFailedError,
} from "../types";

/**
 * Categorize storage error based on error message patterns
 */
function categorizeStorageError(
  errorMessage: string,
): "permission" | "transient" | "not_found" {
  // Check for permission errors
  if (
    errorMessage.includes("403") ||
    errorMessage.includes("permission") ||
    errorMessage.includes("Access denied")
  ) {
    return "permission";
  }

  // Check for not found errors
  if (
    errorMessage.includes("404") ||
    errorMessage.includes("not found") ||
    errorMessage.includes("No such object")
  ) {
    return "not_found";
  }

  // Check for transient errors
  if (
    errorMessage.includes("timeout") ||
    errorMessage.includes("ETIMEDOUT") ||
    errorMessage.includes("ECONNREFUSED") ||
    errorMessage.includes("503") ||
    errorMessage.includes("429")
  ) {
    return "transient";
  }

  // Default to transient for unknown errors
  return "transient";
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
      const file = bucketRef.file(fileName);

      // Save the file with specified content type
      await file.save(fileContent, {
        metadata: {
          contentType,
        },
      });

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

      // Categorize the error type based on error message or code
      const errorType = categorizeStorageError(errorMessage);

      return {
        exists: false,
        error: wrappedError,
        errorType,
      };
    }
  }
}
