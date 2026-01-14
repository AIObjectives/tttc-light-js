import {
  type Message,
  PubSub,
  type Subscription,
  type Topic,
} from "@google-cloud/pubsub";
import { logger } from "tttc-common/logger";
import { getReportRefById } from "../../Firebase";
import type { PipelineJob } from "../../jobs/pipeline";
import { processJob, processJobFailure } from "../../workers";
import type { Queue } from "../types";

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

  async enqueue(item: PipelineJob): Promise<void> {
    await this.ensureInitialized();

    pubsubLogger.info(
      {
        reportId: item.config.firebaseDetails.reportDataUri,
        jobId: item.config.firebaseDetails.firebaseJobId,
      },
      "Enqueueing pipeline job",
    );

    const data = Buffer.from(JSON.stringify(item));
    await this.topic.publishMessage({ data });

    pubsubLogger.info(
      {
        reportId: item.config.firebaseDetails.reportDataUri,
        jobId: item.config.firebaseDetails.firebaseJobId,
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
      try {
        jobData = JSON.parse(message.data.toString()) as PipelineJob;

        // Check if job is already processing or completed (idempotency check)
        const reportId =
          jobData.config.firebaseDetails.reportId ||
          jobData.config.firebaseDetails.firebaseJobId;
        const reportRef = await getReportRefById(reportId);

        if (reportRef) {
          const status = reportRef.status;

          // If completed, ack and skip (idempotent - already done)
          if (status === "completed") {
            pubsubLogger.info(
              {
                reportId,
                jobId: jobData.config.firebaseDetails.firebaseJobId,
                status,
                messageId: message.id,
              },
              "Message already completed, acknowledging duplicate",
            );
            message.ack();
            return;
          }

          // If still processing, ignore without ack (let it redeliver later)
          if (status === "processing") {
            pubsubLogger.info(
              {
                reportId,
                jobId: jobData.config.firebaseDetails.firebaseJobId,
                status,
                messageId: message.id,
              },
              "Message still being processed elsewhere, ignoring without ack",
            );
            return;
          }
        }

        await processJob(jobData);
        message.ack();
      } catch (error) {
        message.nack();
        if (jobData) {
          pubsubLogger.error(
            {
              error,
              messageId: message.id,
            },
            "Pubsub Queue encountered an error while processing message",
          );
          await processJobFailure(
            jobData,
            error instanceof Error ? error : new Error(String(error)),
          );
        } else {
          pubsubLogger.error(
            { error, messageId: message.id },
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
