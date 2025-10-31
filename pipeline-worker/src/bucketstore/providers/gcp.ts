import { Storage } from "@google-cloud/storage";
import { formatError } from "common/utils";
import { BucketStore, UploadFailedError } from "../types";

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

  async storeFile(fileName: string, fileContent: string): Promise<string> {
    try {
      const bucketRef = this.storage.bucket(this.bucketName);
      const file = bucketRef.file(fileName);

      // Save the file with JSON content type
      await file.save(fileContent, {
        metadata: {
          contentType: "application/json",
        },
      });

      // Generate the public URL for the file
      const url = `https://storage.googleapis.com/${this.bucketName}/${fileName}`;

      return url;
    } catch (error) {
      throw new UploadFailedError(fileName, formatError(error));
    }
  }
}
