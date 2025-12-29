import {
  type Message,
  PubSub,
  type Subscription,
  type Topic,
} from "@google-cloud/pubsub";
import { logger } from "tttc-common/logger";
import type { PipelineJob } from "../../jobs/pipeline";
import { processJob, processJobFailure } from "../../workers";
import type { EnqueueOptions, Queue } from "../types";

const pubsubLogger = logger.child({ module: "pubsub" });

type PubSubConfig = {
  projectId?: string;
  apiEndpoint?: string;
};

export class GooglePubSubQueue implements Queue {
  private pubSubClient: PubSub;
  private topic: Topic;
  private subscription: Subscription;
  private initPromise?: Promise<void>;

  constructor(topicName: string, subscriptionName: string, projectId?: string) {
    // Use emulator in development environment
    // Note: PUBSUB_EMULATOR_HOST must be set before this runs (via PM2/env)
    // to prevent MetadataLookupWarning from GCE credential detection
    const pubsubOptions: PubSubConfig = { projectId };

    if (process.env.NODE_ENV === "development") {
      pubsubOptions.projectId = projectId || "dev-project";
    }

    this.pubSubClient = new PubSub(pubsubOptions);
    this.topic = this.pubSubClient.topic(topicName);
    this.subscription = this.topic.subscription(subscriptionName);
  }

  private async ensureInitialized(): Promise<void> {
    if (process.env.NODE_ENV === "development" && !this.initPromise) {
      this.initPromise = this.initializeEmulatorResources();
    }

    if (this.initPromise) {
      await this.initPromise;
    }
  }

  private async initializeEmulatorResources(): Promise<void> {
    try {
      // Get or create topic
      const [topic] = await this.topic.get({ autoCreate: true });
      pubsubLogger.info({ topic: topic.name }, "Topic ready in emulator");

      // Get or create subscription with custom options
      const [subscription] = await this.subscription.get({ autoCreate: true });
      pubsubLogger.info(
        { subscription: subscription.name },
        "Subscription ready in emulator",
      );
    } catch (error) {
      pubsubLogger.error({ error }, "Failed to initialize emulator resources");
      throw error;
    }
  }

  async enqueue(item: PipelineJob, options?: EnqueueOptions): Promise<void> {
    await this.ensureInitialized();

    const requestId = options?.requestId;

    pubsubLogger.info(
      {
        reportId: item.config.firebaseDetails.reportDataUri,
        jobId: item.config.firebaseDetails.firebaseJobId,
        requestId,
      },
      "Enqueueing pipeline job",
    );

    const data = Buffer.from(JSON.stringify(item));

    // Include requestId in message attributes for distributed tracing
    const attributes: Record<string, string> = {};
    if (requestId) {
      attributes.requestId = requestId;
    }

    await this.topic.publishMessage({ data, attributes });

    pubsubLogger.info(
      {
        reportId: item.config.firebaseDetails.reportDataUri,
        jobId: item.config.firebaseDetails.firebaseJobId,
        requestId,
      },
      "Successfully published message to topic",
    );
  }

  async listen(): Promise<void> {
    await this.ensureInitialized();

    pubsubLogger.info(
      { subscription: this.subscription.name },
      "Pubsub now listening",
    );
    this.subscription.on("message", async (message: Message) => {
      let jobData: PipelineJob | undefined;
      // Extract requestId from message attributes for distributed tracing
      const requestId = message.attributes?.requestId;
      try {
        jobData = JSON.parse(message.data.toString()) as PipelineJob;
        await processJob(jobData, requestId);
        message.ack();
      } catch (error) {
        message.nack();
        if (jobData) {
          pubsubLogger.error(
            {
              error,
              messageId: message.id,
              requestId,
            },
            "Pubsub Queue encountered an error while processing message",
          );
          processJobFailure(
            jobData,
            error instanceof Error ? error : new Error(String(error)),
            requestId,
          );
        } else {
          pubsubLogger.error(
            { error, messageId: message.id, requestId },
            "Failed to parse message data",
          );
        }
      }
    });

    this.subscription.on("error", (error: Error) => {
      pubsubLogger.error({ error }, "Pubsub listener encountered an error");
    });
  }

  async close(): Promise<void> {
    await this.subscription.close();
  }
}
