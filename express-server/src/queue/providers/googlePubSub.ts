import { PubSub, Topic, Subscription, Message } from "@google-cloud/pubsub";
import { Queue } from "../types";
import { PipelineJob } from "../../jobs/pipeline";
import { processJob, processJobFailure } from "../../workers";
import { logger } from "tttc-common/logger";

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
    const pubsubOptions: PubSubConfig = { projectId };

    if (process.env.NODE_ENV === "development") {
      // Configure for Pub/Sub emulator
      pubsubOptions.apiEndpoint = "localhost:8085";
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
    this.subscription.on("message", (message: Message) => {
      const jobData = JSON.parse(message.data.toString()) as PipelineJob;

      processJob(jobData)
        .then(() => {
          message.ack(); // Only ack on success
        })
        .catch((error: Error) => {
          pubsubLogger.error(
            {
              error: error,
              messageId: message.id,
            },
            "Job processing failed - marking as failed without automatic retry",
          );
          processJobFailure(jobData, error);
          message.ack(); // Acknowledge to prevent automatic retry loops
        });
    });

    this.subscription.on("error", (error: Error) => {
      pubsubLogger.error({ error }, "Pubsub listener encountered an error");
    });
  }

  async close(): Promise<void> {
    await this.subscription.close();
  }
}
