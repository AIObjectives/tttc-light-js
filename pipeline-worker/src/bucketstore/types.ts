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
   * @returns A Promise containing the URL to retrieve the file
   * @throws {UploadFailedError} When the upload fails
   * @throws {BucketNotFoundError} When the bucket is not found
   * @throws {AccessDeniedError} When access is denied
   */
  storeFile(fileName: string, fileContent: string): Promise<string>;
}

/**
 * Configuration for GCP Cloud Storage provider
 */
export type GCPBucketStoreConfig = {
  provider: "gcp";
  bucketName: string;
  projectId?: string;
};

/**
 * Union type for all supported bucket store providers.
 * Add new provider configs here as they are implemented.
 */
export type BucketStoreConfig = GCPBucketStoreConfig;
