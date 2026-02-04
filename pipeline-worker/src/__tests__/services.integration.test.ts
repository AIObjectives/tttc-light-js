import { describe, expect, it } from "vitest";
import { initServices } from "../services";

describe("Services Health Checks Integration", () => {
  it("should successfully initialize services when Redis and GCS are available", async () => {
    // This test requires real Redis and GCS to be available
    // Skip if environment variables are not set
    if (
      !process.env.REDIS_HOST ||
      !process.env.GCLOUD_STORAGE_BUCKET ||
      !process.env.GOOGLE_CLOUD_PROJECT
    ) {
      console.log("⚠️  Skipping: Required environment variables not set");
      return;
    }

    const services = await initServices();

    expect(services).toBeDefined();
    expect(services.Cache).toBeDefined();
    expect(services.Storage).toBeDefined();
    expect(services.RefStore).toBeDefined();
    expect(services.PipelineStateStore).toBeDefined();
    expect(services.handlePushMessage).toBeDefined();

    // Verify health checks pass
    await expect(services.Cache.healthCheck()).resolves.not.toThrow();
    await expect(services.Storage.healthCheck()).resolves.not.toThrow();
  });

  it("should fail initialization if Redis is not available", async () => {
    if (
      !process.env.GCLOUD_STORAGE_BUCKET ||
      !process.env.GOOGLE_CLOUD_PROJECT
    ) {
      console.log("⚠️  Skipping: Required environment variables not set");
      return;
    }

    // Temporarily point to invalid Redis host
    const originalHost = process.env.REDIS_HOST;
    process.env.REDIS_HOST = "invalid-redis-host.example.com";

    try {
      await expect(initServices()).rejects.toThrow();
    } finally {
      // Restore original host
      if (originalHost) {
        process.env.REDIS_HOST = originalHost;
      }
    }
  });

  it("should fail initialization if GCS bucket is not accessible", async () => {
    if (!process.env.REDIS_HOST) {
      console.log("⚠️  Skipping: Required environment variables not set");
      return;
    }

    // Temporarily point to invalid bucket
    const originalBucket = process.env.GCLOUD_STORAGE_BUCKET;
    process.env.GCLOUD_STORAGE_BUCKET =
      "invalid-bucket-that-does-not-exist-12345";

    try {
      await expect(initServices()).rejects.toThrow();
    } finally {
      // Restore original bucket
      if (originalBucket) {
        process.env.GCLOUD_STORAGE_BUCKET = originalBucket;
      }
    }
  });
});
