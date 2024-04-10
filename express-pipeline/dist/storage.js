"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true,
});
exports.getUrl = void 0;
exports.storeJSON = storeJSON;
var _storage = require("@google-cloud/storage");
let storage;
const encoded_creds = process.env.GOOGLE_CREDENTIALS_ENCODED;
if (encoded_creds) {
  const decoded = Buffer.from(encoded_creds, "base64").toString("utf-8");
  storage = new _storage.Storage({
    credentials: JSON.parse(decoded),
  });
}
const bucketName = process.env.GCLOUD_STORAGE_BUCKET;
const getUrl = (fileName) =>
  `https://storage.googleapis.com/${bucketName}/${fileName}`;
exports.getUrl = getUrl;
async function storeJSON(fileName, fileContent, allowCache) {
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
      contentType: "application.json",
      ...(allowCache
        ? {}
        : {
            cacheControl: "no-cache, no-store, must-revalidate",
          }),
    },
  });
  return getUrl(fileName);
}
