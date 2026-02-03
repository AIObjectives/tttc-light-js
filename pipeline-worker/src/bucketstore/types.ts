/**
 * Base class for all bucket store errors
 */
export class BucketStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BucketStoreError";
  }
}

/**
 * Error thrown when a bucket is not found
 */
export class BucketNotFoundError extends BucketStoreError {
  constructor(public bucket: string) {
    super(`Bucket not found: ${bucket}`);
    this.name = "BucketNotFoundError";
  }
}

/**
 * Error thrown when a file upload fails
 */
export class UploadFailedError extends BucketStoreError {
  constructor(
    public fileName: string,
    public reason: string,
  ) {
    super(`Upload failed for ${fileName}: ${reason}`);
    this.name = "UploadFailedError";
  }
}

/**
 * Error thrown when access is denied to a file
 */
export class AccessDeniedError extends BucketStoreError {
  constructor(public fileName: string) {
    super(`Access denied for file: ${fileName}`);
    this.name = "AccessDeniedError";
  }
}

/**
 * Error thrown when URL generation fails
 */
export class UrlGenerationFailedError extends BucketStoreError {
  constructor(
    public fileName: string,
    public reason: string,
  ) {
    super(`URL generation failed for ${fileName}: ${reason}`);
    this.name = "UrlGenerationFailedError";
  }
}

/**
 * Error thrown when a file deletion fails
 */
export class DeleteFailedError extends BucketStoreError {
  constructor(
    public fileName: string,
    public reason: string,
    public errorType?: "permission" | "transient" | "not_found" | "permanent",
  ) {
    super(`Delete failed for ${fileName}: ${reason}`);
    this.name = "DeleteFailedError";
  }
}

/**
 * Result of checking file existence
 */
export type FileExistsResult =
  | { exists: true; error?: never; errorType?: never }
  | { exists: false; error?: never; errorType?: never }
  | {
      exists: false;
      error: Error;
      errorType: "permission" | "transient" | "not_found" | "permanent";
    };

/**
 * Generic interface for bucket storage operations.
 *
 * This interface provides a cloud-agnostic abstraction for storing
 * files in bucket storage (e.g., GCP Cloud Storage, AWS S3).
 * The bucket is specified during initialization.
 */
export interface BucketStore {
  /**
   * Stores a file in the configured bucket.
   *
   * @param fileName - The name of the file to store
   * @param fileContent - The file content as a string
   * @param contentType - Optional MIME type (e.g., "application/json"). Defaults to "application/json".
   * @returns A Promise containing the URL to retrieve the file
   * @throws {UploadFailedError} When the upload fails
   * @throws {BucketNotFoundError} When the bucket is not found
   * @throws {AccessDeniedError} When access is denied
   */
  storeFile(
    fileName: string,
    fileContent: string,
    contentType?: string,
  ): Promise<string>;

  /**
   * Check if a file exists in the configured bucket.
   *
   * @param fileName - The name of the file to check
   * @returns A result object indicating existence and any errors encountered
   */
  fileExists(fileName: string): Promise<FileExistsResult>;

  /**
   * Deletes a file from the configured bucket.
   *
   * @param fileName - The name of the file to delete
   * @returns A Promise that resolves when the file is deleted
   * @throws {DeleteFailedError} When the deletion fails
   * @throws {BucketNotFoundError} When the bucket is not found
   * @throws {AccessDeniedError} When access is denied
   */
  deleteFile(fileName: string): Promise<void>;

  /**
   * Verifies bucket accessibility and permissions.
   *
   * @returns A Promise that resolves when the bucket is accessible
   * @throws {BucketNotFoundError} When the bucket is not found
   * @throws {AccessDeniedError} When access is denied
   * @throws {BucketStoreError} When verification fails for other reasons
   */
  healthCheck(): Promise<void>;
}

/**
 * Configuration for GCP Cloud Storage provider
 */
export type GCPBucketStoreConfig = {
  provider: "gcp";
  bucketName: string;
  projectId?: string;
  credentials?: Record<string, unknown>;
};

/**
 * Union type for all supported bucket store providers.
 * Add new provider configs here as they are implemented.
 */
export type BucketStoreConfig = GCPBucketStoreConfig;
