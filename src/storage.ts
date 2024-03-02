import { Storage } from "@google-cloud/storage";

const storage = new Storage();
const bucketName = process.env.GCLOUD_STORAGE_BUCKET;

export async function storeHtml(fileName: string, fileContent: string) {
  if (!bucketName) {
    return {
      status: "error",
      message: "GCLOUD_STORAGE_BUCKET is not set",
    };
  }
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileName);
  try {
    await file.save(fileContent, {
      metadata: {
        contentType: "text/html",
      },
    });
    return {
      status: "ok",
      url: `https://storage.googleapis.com/${bucketName}/${fileName}`,
    };
  } catch (e: any) {
    return {
      status: "error",
      message: e.message,
    };
  }
}
