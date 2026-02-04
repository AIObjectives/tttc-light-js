import { PubSub } from "@google-cloud/pubsub";
import { logger } from "tttc-common/logger";
import { pipelineJobSchema } from "tttc-common/schema";
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
import { GooglePubSub } from "./queue/googlepubsub";
import { handlePipelineJob } from "./queue/handler";

const servicesLogger = logger.child({ module: "services" });

export interface Services {
  RefStore: RefStoreServices;
  Cache: Cache;
  PipelineStateStore: RedisPipelineStateStore;
  Queue: GooglePubSub<typeof pipelineJobSchema> | null;
  Storage: BucketStore;
  handlePushMessage: (message: {
    id: string;
    data: z.infer<typeof pipelineJobSchema>;
    attributes?: Record<string, string>;
    publishTime: Date;
  }) => Promise<void>;
}

export interface MessageTracking {
  onMessageStart: () => void;
  onMessageEnd: () => void;
}

export async function initServices(
  messageTracking?: MessageTracking,
  usePushSubscription = false,
): Promise<Services> {
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

  // Always use Application Default Credentials (Cloud Run service account)
  servicesLogger.info(
    { bucketName, projectId },
    "Initializing GCS with Application Default Credentials",
  );

  const Storage = createBucketStore({
    provider: "gcp",
    bucketName,
    projectId,
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

  // Define the message handler that will be used by both push and pull modes
  const messageHandler = async (message: {
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

      // Only throw for transient errors to trigger message retry
      if (error.isTransient) {
        throw error; // In pull mode: nack message. In push mode: return 5xx
      }
      // For permanent errors: log but don't throw (let message ack / return 2xx)
      // Firestore already updated with error status by handlePipelineJob
    }
  };

  let Queue: GooglePubSub<typeof pipelineJobSchema> | null = null;

  // Only set up pull subscription if not using push mode
  if (!usePushSubscription) {
    // Initialize PubSub queue for pull subscriptions
    const pubsubClient = new PubSub({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
    });

    const topicName = process.env.PUBSUB_TOPIC || "pipeline-jobs";
    const subscriptionName =
      process.env.PUBSUB_SUBSCRIPTION || "pipeline-worker";

    // Verify subscription exists before connecting
    try {
      const subscription = pubsubClient
        .topic(topicName)
        .subscription(subscriptionName);
      const [exists] = await subscription.exists();
      if (!exists) {
        throw new Error(
          `Subscription '${subscriptionName}' does not exist on topic '${topicName}'. ` +
            `Please create it before starting the worker.`,
        );
      }
      servicesLogger.info(
        { topic: topicName, subscription: subscriptionName },
        "Verified PubSub subscription exists",
      );
    } catch (error) {
      servicesLogger.error(
        {
          error,
          topic: topicName,
          subscription: subscriptionName,
          project: process.env.GOOGLE_CLOUD_PROJECT,
        },
        "Failed to verify PubSub subscription",
      );
      throw error;
    }

    Queue = new GooglePubSub(
      pubsubClient,
      topicName,
      subscriptionName,
      pipelineJobSchema,
    );

    // Configure subscription options for autoscaling
    // In production, limit concurrent messages per instance to control resource usage
    const isProduction = process.env.NODE_ENV === "production";
    const subscriptionOptions = {
      ...(isProduction
        ? {
            // Ack deadline: 35 minutes (matches lock TTL from pipeline constants)
            ackDeadline: 2100,
            flowControl: {
              // Max concurrent messages per worker instance
              // Each pipeline job can take 30+ minutes and significant memory
              maxMessages: 5,
              // Max 500MB in memory for message data (conservative estimate)
              maxBytes: 500 * 1024 * 1024,
              // Don't allow excess messages to prevent resource exhaustion
              allowExcessMessages: false,
            },
          }
        : {}),
      // Add message tracking callbacks for graceful shutdown
      ...(messageTracking ? { messageTracking } : {}),
    };

    // Start listening for messages (only after health checks pass)
    await Queue.subscribe(
      subscriptionName,
      messageHandler,
      subscriptionOptions,
    ).catch((error) => {
      servicesLogger.error({ error }, "Failed to start queue subscription");
      throw error;
    });

    servicesLogger.info(
      {
        topic: topicName,
        subscription: subscriptionName,
      },
      "Queue subscription started (pull mode)",
    );
  } else {
    servicesLogger.info(
      "Push subscription mode enabled - waiting for HTTP POST requests",
    );
  }

  return {
    RefStore,
    Cache,
    PipelineStateStore,
    Queue,
    Storage,
    handlePushMessage: messageHandler,
  };
}
