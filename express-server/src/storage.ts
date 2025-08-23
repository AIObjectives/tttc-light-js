import {
  Storage as BucketStorage,
  Bucket as GBucket,
  GetSignedUrlConfig,
} from "@google-cloud/storage";
import { CustomError } from "./error";
import * as schema from "tttc-common/schema";
import { z } from "zod";
import { Result } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import { Env } from "./types/context";

const storageLogger = logger.child({ module: "storage" });

const fileContent = z.union([schema.pipelineOutput, schema.uiReportData]);
type FileContent = z.infer<typeof fileContent>;

/**
 * Abstract class for anything that involves storing reports
 */
export abstract class Storage {
  abstract get(fileName: string): Promise<Result<FileContent, StorageGetError>>;
  abstract getUrl(
    fileName: string,
  ): Promise<Result<string, StorageGetUrlError>>;
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

  static VALID_FILENAME_REGEX = /^[^(\r\n#\[\]*?\:"<>|)]+$/; // GCS filenames are very permissive, so we check the negative.
  static MAX_FILENAME_LENGTH = 512; // Reasonable max length for filenames

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

  async getUrl(fileName: string): Promise<Result<string, StorageGetUrlError>> {
    const expiresInSeconds: number = 60 * 60; // 1 hour default
    // fileName must be decoded (with spaces not %20), not encoded
    const file = this.bucket.file(fileName);
    try {
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + expiresInSeconds * 1000,
      } as GetSignedUrlConfig);
      return { tag: "success", value: url };
    } catch (e) {
      return {
        tag: "failure",
        error: new StorageGetUrlError("Could not generate URL"),
      };
    }
  }

  /**
   * Gets report data from storage bucket. Returns either the content or an error value
   */
  async get(fileName: string): Promise<Result<FileContent, StorageGetError>> {
    try {
      const [data] = await this.bucket.file(fileName).download();
      try {
        const parsed = fileContent.safeParse(JSON.parse(data.toString()));
        if (parsed.success) {
          return {
            tag: "success",
            value: parsed.data,
          };
        } else {
          storageLogger.error(
            {
              fileName,
              error: parsed.error,
            },
            "Invalid JSON format in file",
          );
          return {
            tag: "failure",
            error: new InvalidJSONFormat(parsed.error),
          };
        }
      } catch (jsonErr) {
        storageLogger.error(
          {
            fileName,
            error: jsonErr,
          },
          "JSON parse error in file",
        );
        return {
          tag: "failure",
          error: new InvalidJSONFormat(jsonErr),
        };
      }
    } catch (e) {
      storageLogger.error(
        {
          fileName,
          error: e,
        },
        "Failed to download file",
      );
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
    // Validate filename before saving
    if (!fileName || typeof fileName !== "string") {
      return {
        tag: "failure",
        error: new BucketSaveError(
          new Error("Invalid filename: must be a non-empty string"),
        ),
      };
    }

    const file = this.bucket.file(fileName);
    try {
      await file.save(fileContent, {
        metadata: {
          contentType: "application/json",
          // Cache control here is required to successfully save to bucket for some reason.
          cacheControl: "no-cache, no-store, must-revalidate",
        },
      });

      const resultUrl = this.storageUrl(fileName);

      // Validate that the generated URL contains the expected filename
      const urlFilename = decodeURIComponent(
        new URL(resultUrl).pathname.split("/").pop() || "",
      );
      if (urlFilename !== fileName) {
        storageLogger.error(
          {
            expectedFilename: fileName,
            actualUrlFilename: urlFilename,
            resultUrl,
          },
          "CRITICAL: Storage URL filename mismatch detected",
        );
        return {
          tag: "failure",
          error: new BucketSaveError(
            new Error(
              `Storage URL filename mismatch: expected ${fileName}, got ${urlFilename}`,
            ),
          ),
        };
      }

      return {
        tag: "success",
        value: resultUrl,
      };
    } catch (e) {
      return {
        tag: "failure",
        error: new BucketSaveError(e),
      };
    }
  }

  /**
   * Extracts the bucket name and file name from a GCS URL or returns the file name if it's a plain filename.
   * Returns { bucket: string, fileName: string } or null if invalid.
   */
  static parseUri(
    uri: string,
    defaultBucket: string,
  ): Result<{ bucket: string; fileName: string }, ParseUriError> {
    // If it's already a valid filename (not a url), use the default bucket
    if (Bucket.isValidFileName(uri)) {
      return {
        tag: "success",
        value: { bucket: defaultBucket, fileName: uri },
      };
    }

    try {
      const url = new URL(uri); // Note this encodes the URL, so we decode it again before returning.

      // Match GCS URL pattern: https://storage.googleapis.com/bucket/file
      if (url.hostname === "storage.googleapis.com") {
        const [_, bucket, ...fileParts] = url.pathname.split("/");
        if (bucket && fileParts.length > 0) {
          // Returns decoded fileName (with spaces, not %20)
          return {
            tag: "success",
            value: {
              bucket,
              fileName: decodeURIComponent(fileParts.join("/")),
            },
          };
        }
      }
    } catch {
      // Not a valid URL, fall through
    }
    return {
      tag: "failure",
      error: new ParseUriError("Invalid or unsupported URI"),
    };
  }

  static isValidFileName(fileName: string | undefined): boolean {
    return (
      typeof fileName === "string" &&
      fileName.length > 0 &&
      fileName.length <= Bucket.MAX_FILENAME_LENGTH &&
      Bucket.VALID_FILENAME_REGEX.test(fileName) &&
      !fileName.includes("..") &&
      !fileName.includes("/") &&
      fileName !== "index.js" // Prevents serving index.js directly
    );
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

class ParseUriError extends CustomError<"ParseUriError"> {
  constructor(message: string) {
    super("ParseUriError", message);
  }
}

class StorageGetUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageGetUrlError";
  }
}

export const createStorage = (env: Env): Storage => {
  // since Bucket is the only storage class, just return this for now.
  return new Bucket(env.GOOGLE_CREDENTIALS_ENCODED, env.GCLOUD_STORAGE_BUCKET);
};
