import { Storage } from "@google-cloud/storage";

let storage: any;
const encoded_creds = process.env.GOOGLE_CREDENTIALS_ENCODED;
if (encoded_creds) {
  const decoded = Buffer.from(encoded_creds, "base64").toString("utf-8");
  storage = new Storage({ credentials: JSON.parse(decoded) });
}

const bucketName = process.env.GCLOUD_STORAGE_BUCKET;

export async function storeHtml(fileName: string, fileContent: string) {
  if (!bucketName) {
    throw new Error("Missing bucket name (GCLOUD_STORAGE_BUCKET).");
  }
  if (!storage) {
    throw new Error("Missing google creds (GOOGLE_CREDENTIALS_ENCODED)");
  }
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileName);
  await file.save(fileContent, {
    metadata: {
      contentType: "text/html",
    },
  });
  return `https://storage.googleapis.com/${bucketName}/${fileName}`;
}
