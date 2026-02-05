import { logger } from "tttc-common/logger";
import type { pipelineJobSchema } from "tttc-common/schema";
import type { z } from "zod";
import type { BucketStore } from "./bucketstore";
import { createBucketStore } from "./bucketstore";
import type { Cache } from "./cache";
import { CacheServicesLive } from "./cache/services";
import {
  type RefStoreServices,
  RefStoreServicesLive,
} from "./datastore/refstore";
import { RedisPipelineStateStore } from "./pipeline-runner/state-store";
import { handlePipelineJob } from "./queue/handler";

const servicesLogger = logger.child({ module: "services" });

export interface Services {
  RefStore: RefStoreServices;
  Cache: Cache;
  PipelineStateStore: RedisPipelineStateStore;
  Storage: BucketStore;
  handlePushMessage: (message: {
    id: string;
    data: z.infer<typeof pipelineJobSchema>;
    attributes?: Record<string, string>;
    publishTime: Date;
  }) => Promise<void>;
}

export async function initServices(): Promise<Services> {
  const RefStore = RefStoreServicesLive(process.env);
  const Cache = CacheServicesLive(process.env);

  // Initialize pipeline state store
  const PipelineStateStore = new RedisPipelineStateStore(Cache);

  // Initialize GCS storage
  const bucketName = process.env.GCLOUD_STORAGE_BUCKET;
  const encodedCredentials = process.env.GOOGLE_CREDENTIALS_ENCODED;

  if (!bucketName) {
    throw new Error("Missing GCLOUD_STORAGE_BUCKET environment variable");
  }

  if (!encodedCredentials) {
    throw new Error("Missing GOOGLE_CREDENTIALS_ENCODED environment variable");
  }

  // Decode base64 credentials
  const credentials = JSON.parse(
    Buffer.from(encodedCredentials, "base64").toString("utf-8"),
  );

  servicesLogger.info(
    { bucketName, projectId: credentials.project_id },
    "Initializing GCS with encoded credentials",
  );

  const Storage = createBucketStore({
    provider: "gcp",
    bucketName,
    projectId: credentials.project_id,
    credentials,
  });

  // Verify Redis connectivity before proceeding
  servicesLogger.info("Verifying Redis connectivity...");
  try {
    await Cache.healthCheck();
    servicesLogger.info("Redis health check passed");
  } catch (error) {
    servicesLogger.error({ error }, "Redis health check failed");
    throw error;
  }

  // Verify GCS accessibility before proceeding
  servicesLogger.info(
    { bucket: bucketName },
    "Verifying GCS bucket accessibility...",
  );
  try {
    await Storage.healthCheck();
    servicesLogger.info({ bucket: bucketName }, "GCS health check passed");
  } catch (error) {
    servicesLogger.error(
      { error, bucket: bucketName },
      "GCS health check failed",
    );
    throw error;
  }

  // Message handler for push subscriptions
  const handlePushMessage = async (message: {
    id: string;
    data: z.infer<typeof pipelineJobSchema>;
    attributes?: Record<string, string>;
    publishTime: Date;
  }) => {
    const result = await handlePipelineJob(
      message,
      PipelineStateStore,
      Storage,
      RefStore,
    );

    if (result.tag === "failure") {
      const error = result.error;
      servicesLogger.error(
        { error, messageId: message.id },
        "Failed to process pipeline job",
      );

      // Only throw for transient errors to trigger retry (5xx response)
      if (error.isTransient) {
        throw error;
      }
      // For permanent errors: log but don't throw (return 2xx to ack)
      // Firestore already updated with error status by handlePipelineJob
    }
  };

  servicesLogger.info(
    "Pipeline worker initialized - waiting for push subscription messages",
  );

  return {
    RefStore,
    Cache,
    PipelineStateStore,
    Storage,
    handlePushMessage,
  };
}
