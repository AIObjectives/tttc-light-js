import {
  Storage as BucketStorage,
  Bucket as GBucket,
} from "@google-cloud/storage";
import { CustomError } from "./error";
import * as schema from "tttc-common/schema";
import { z } from "zod";

const fileContent = z.union([schema.pipelineOutput, schema.uiReportData]);
type FileContent = z.infer<typeof fileContent>;

/**
 * Abstract class for anything that involves storing reports
 */
export abstract class Storage {
  abstract get(fileName: string): Promise<FileContent | StorageGetError>;
  abstract save(
    fileName: string,
    fileContent: string,
  ): Promise<string | StorageSaveError>;
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
  async get(fileName: string): Promise<FileContent | StorageGetError> {
    try {
      const data = await this.bucket.file(this.storageUrl(fileName)).download();
      const parsed = fileContent.safeParse(data);
      if (parsed.success) {
        return parsed.data;
      } else {
        return new InvalidJSONFormat(parsed.error);
      }
    } catch (e) {
      return new BucketGetError(e);
    }
  }

  /**
   * Saves data to storage bucket. Returns either the storage url or an error.
   */
  async save(fileName: string, fileContent: string) {
    const file = this.bucket.file(fileName);
    try {
      await file.save(fileContent, {
        metadata: {
          contentType: "application/json",
        },
      });
      return this.storageUrl(fileName);
    } catch (e) {
      return new BucketSaveError(e);
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
