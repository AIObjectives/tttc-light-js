import { Storage } from "@google-cloud/storage";
import { validateEnv } from "./types/context";

// Get validated environment variables
const env = validateEnv();
const { GOOGLE_CREDENTIALS_ENCODED, GCLOUD_STORAGE_BUCKET } = env;

let storage: any;
if (GOOGLE_CREDENTIALS_ENCODED) {
  const decoded = Buffer.from(GOOGLE_CREDENTIALS_ENCODED, "base64").toString("utf-8");
  storage = new Storage({ credentials: JSON.parse(decoded) });
}

export const getStorageUrl = (fileName: string) =>
  `https://storage.googleapis.com/${GCLOUD_STORAGE_BUCKET}/${fileName}`;

export async function storeJSON(
  fileName: string,
  fileContent: string,
  allowCache?: boolean,
) {
  if (!GCLOUD_STORAGE_BUCKET) {
    throw new Error("Missing bucket name (GCLOUD_STORAGE_BUCKET).");
  }
  if (!storage) {
    throw new Error("Missing google creds (GOOGLE_CREDENTIALS_ENCODED)");
  }
  const bucket = storage.bucket(GCLOUD_STORAGE_BUCKET);
  const file = bucket.file(fileName);
  await file.save(fileContent, {
    metadata: {
      contentType: "application/json",
      ...(allowCache
        ? {}
        : {
            cacheControl: "no-cache, no-store, must-revalidate",
          }),
    },
  });
  return getStorageUrl(fileName);
}
