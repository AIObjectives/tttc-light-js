import { PubSub } from "@google-cloud/pubsub";
import { logger } from "tttc-common/logger";
import { pipelineJobSchema } from "tttc-common/schema";
import type { BucketStore } from "./bucketstore";
import { createBucketStore } from "./bucketstore";
import type { Cache } from "./cache";
import { CacheServicesLive } from "./cache/services";
import {
  type RefStoreServices,
  RefStoreServicesLive,
} from "./datastore/refstore";
import { RedisPipelineStateStore } from "./pipeline-runner/state-store";
import { GooglePubSub } from "./queue/googlepubsub";
import { handlePipelineJob } from "./queue/handler";

const servicesLogger = logger.child({ module: "services" });

export interface Services {
  RefStore: RefStoreServices;
  Cache: Cache;
  PipelineStateStore: RedisPipelineStateStore;
  Queue: GooglePubSub<typeof pipelineJobSchema>;
  Storage: BucketStore;
}

export function initServices(): Services {
  const RefStore = RefStoreServicesLive(process.env);
  const Cache = CacheServicesLive(process.env);

  // Initialize pipeline state store
  const PipelineStateStore = new RedisPipelineStateStore(Cache);

  // Initialize GCS storage
  const bucketName = process.env.GCLOUD_STORAGE_BUCKET;
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;

  if (!bucketName) {
    throw new Error("Missing GCLOUD_STORAGE_BUCKET environment variable");
  }

  const Storage = createBucketStore({
    provider: "gcp",
    bucketName,
    projectId,
  });

  // Initialize PubSub queue
  const pubsubClient = new PubSub({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
  });

  const topicName = process.env.PUBSUB_TOPIC || "pipeline-jobs";
  const subscriptionName = process.env.PUBSUB_SUBSCRIPTION || "pipeline-worker";

  const Queue = new GooglePubSub(
    pubsubClient,
    topicName,
    subscriptionName,
    pipelineJobSchema,
  );

  // Start listening for messages
  Queue.subscribe(subscriptionName, async (message) => {
    try {
      await handlePipelineJob(message, PipelineStateStore, Storage, RefStore);
    } catch (error) {
      servicesLogger.error(
        {
          error: error instanceof Error ? error : new Error(String(error)),
          messageId: message.id,
        },
        "Failed to process pipeline job",
      );
      throw error; // Re-throw to trigger nack
    }
  }).catch((error) => {
    servicesLogger.error({ error }, "Failed to start queue subscription");
    throw error;
  });

  servicesLogger.info(
    {
      topic: topicName,
      subscription: subscriptionName,
    },
    "Queue subscription started",
  );

  return {
    RefStore,
    Cache,
    PipelineStateStore,
    Queue,
    Storage,
  };
}
