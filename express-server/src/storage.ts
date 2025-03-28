import {
  Storage as BucketStorage,
  Bucket as GBucket,
} from "@google-cloud/storage";
import { CustomError } from "./error";
import * as schema from "tttc-common/schema";
import { z } from "zod";
import { Result } from "./types/result";
import { Env } from "./types/context";

const fileContent = z.union([schema.pipelineOutput, schema.uiReportData]);
type FileContent = z.infer<typeof fileContent>;

/**
 * Abstract class for anything that involves storing reports
 */
export abstract class Storage {
  abstract get(fileName: string): Promise<Result<FileContent, StorageGetError>>;
  abstract save(
    fileName: string,
    fileContent: string,
  ): Promise<Result<string, StorageSaveError>>;
}

/**
 * Google Cloud Storage Buckets
 */
export class Bucket extends Storage {
  private name: string;
  private storage: BucketStorage;
  private bucket: GBucket;

  constructor(encoded_creds: string, name: string) {
    super();
    this.name = name;
    this.storage = new BucketStorage({
      credentials: this.decodeCredentials(encoded_creds),
    });
    this.bucket = this.storage.bucket(this.name);
  }

  private decodeCredentials = (encoded_creds: string) =>
    JSON.parse(Buffer.from(encoded_creds, "base64").toString("utf-8"));
  private storageUrl = (fileName: string) =>
    `https://storage.googleapis.com/${this.name}/${fileName}`;

  /**
   * Gets report data from storage bucket. Returns either the content or an error value
   */
  async get(fileName: string): Promise<Result<FileContent, StorageGetError>> {
    try {
      const data = await this.bucket.file(this.storageUrl(fileName)).download();
      const parsed = fileContent.safeParse(data);
      if (parsed.success) {
        return {
          tag: "success",
          value: parsed.data,
        };
      } else {
        return {
          tag: "failure",
          error: new InvalidJSONFormat(parsed.error),
        };
      }
    } catch (e) {
      return {
        tag: "failure",
        error: new BucketGetError(e),
      };
    }
  }

  /**
   * Saves data to storage bucket. Returns either the storage url or an error.
   */
  async save(
    fileName: string,
    fileContent: string,
  ): Promise<Result<string, StorageSaveError>> {
    const file = this.bucket.file(fileName);
    try {
      await file.save(fileContent, {
        metadata: {
          contentType: "application/json",
          // Cache control here is required to successfully save to bucket for some reason.
          cacheControl: "no-cache, no-store, must-revalidate",
        },
      });
      return {
        tag: "success",
        value: this.storageUrl(fileName),
      };
    } catch (e) {
      return {
        tag: "failure",
        error: new BucketSaveError(e),
      };
    }
  }
}

type StorageGetError = BucketGetError | InvalidJSONFormat;

type StorageSaveError = BucketSaveError;

class BucketGetError extends CustomError<"BucketGetError"> {
  constructor(err?: unknown) {
    super("BucketGetError", err);
  }
}

class InvalidJSONFormat extends CustomError<"InvalidJSONFormat"> {
  constructor(err?: unknown) {
    super("InvalidJSONFormat", err);
  }
}

class BucketSaveError extends CustomError<"BucketSaveError"> {
  constructor(err?: unknown) {
    super("BucketSaveError", err);
  }
}

export const createStorage = (
  env: Env,
  control: "public" | "private",
): Storage => {
  // since Bucket is the only storage class, just return this for now.
  if (control === "public")
    return new Bucket(
      env.GOOGLE_CREDENTIALS_ENCODED,
      env.GCLOUD_STORAGE_BUCKET,
    );
  else
    return new Bucket(
      env.GOOGLE_CREDENTIALS_ENCODED,
      env.GLCOUD_STORAGE_BUCKET_PRIVATE,
    );
};
