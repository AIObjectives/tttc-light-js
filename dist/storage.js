"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.storeHtml = storeHtml;
var _storage = require("@google-cloud/storage");
const storage = new _storage.Storage();
const bucketName = process.env.GCLOUD_STORAGE_BUCKET;
async function storeHtml(fileName, fileContent) {
  if (!bucketName) {
    return {
      status: "error",
      message: "GCLOUD_STORAGE_BUCKET is not set"
    };
  }
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileName);
  try {
    await file.save(fileContent, {
      metadata: {
        contentType: "text/html"
      }
    });
    return {
      status: "ok",
      url: `https://storage.googleapis.com/${bucketName}/${fileName}`
    };
  } catch (e) {
    return {
      status: "error",
      message: e.message
    };
  }
}