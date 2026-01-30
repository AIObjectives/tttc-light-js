import type {
  Message,
  PubSub,
  Subscription,
  Topic,
} from "@google-cloud/pubsub";
import { Duration } from "@google-cloud/pubsub";
import { logger } from "tttc-common/logger";
import type { z } from "zod";
import type { PubSubInterface, PubSubMessage, PubSubSubscription } from ".";

const pubsubLogger = logger.child({ module: "googlepubsub" });

export class GooglePubSub<T extends z.ZodTypeAny>
  implements PubSubInterface<T>
{
  private client: PubSub;
  private activeSubscriptions = new Map<string, Subscription>();
  private schema: T;
  private topic: Topic;
  private subscription: Subscription;

  constructor(
    client: PubSub,
    topic: string,
    subscriptionName: string,
    schema: T,
  ) {
    this.schema = schema;
    this.client = client;
    this.topic = this.client.topic(topic);
    this.subscription = this.topic.subscription(subscriptionName);
  }

  async subscribe(
    subscriptionName: string,
    handler: (message: PubSubMessage<z.infer<T>>) => Promise<void> | void,
    options?: {
      maxMessages?: number;
      ackDeadline?: number;
      flowControl?: {
        maxMessages?: number;
        maxBytes?: number;
        allowExcessMessages?: boolean;
      };
    },
  ): Promise<PubSubSubscription> {
    const messageHandler = async (message: Message) => {
      // Track active message for graceful shutdown
      const incrementActive = (global as any).__incrementActiveMessages;
      const decrementActive = (global as any).__decrementActiveMessages;
      if (incrementActive) incrementActive();

      try {
        const json = JSON.parse(message.data.toString());
        const parsedData = this.schema.parse(json);
        const pubsubMessage: PubSubMessage<z.infer<T>> = {
          id: message.id,
          data: parsedData,
          attributes: message.attributes,
          publishTime: new Date(message.publishTime),
        };

        await handler(pubsubMessage);
        message.ack();
      } catch (e) {
        // Extract as much context as possible from the raw message for debugging
        const errorContext: Record<string, unknown> = {
          messageId: message.id,
          error: e,
        };

        // Try to extract reportId, userId, and requestId from the raw message
        // This provides critical debugging context even when parsing/validation fails
        try {
          const rawJson = JSON.parse(message.data.toString());
          if (rawJson?.config?.firebaseDetails?.reportId) {
            errorContext.reportId = rawJson.config.firebaseDetails.reportId;
          }
          if (rawJson?.config?.firebaseDetails?.userId) {
            errorContext.userId = rawJson.config.firebaseDetails.userId;
          }
        } catch {
          // If we can't parse JSON at all, just log without these fields
        }

        // Extract requestId from message attributes for request correlation
        if (message.attributes?.requestId) {
          errorContext.requestId = message.attributes.requestId;
        }

        pubsubLogger.error(errorContext, "Error processing message");
        message.nack();
      } finally {
        // Decrement active count on completion or error
        if (decrementActive) decrementActive();
      }
    };

    // Configure flow control and subscription options
    if (options?.flowControl) {
      this.subscription.setOptions({
        flowControl: {
          maxMessages: options.flowControl.maxMessages,
          maxBytes: options.flowControl.maxBytes,
          allowExcessMessages: options.flowControl.allowExcessMessages,
        },
      });
      pubsubLogger.info(
        { flowControl: options.flowControl },
        "Flow control configured",
      );
    }

    if (options?.ackDeadline) {
      const ackDeadlineDuration = Duration.from({
        seconds: options.ackDeadline,
      });
      this.subscription.setOptions({
        minAckDeadline: ackDeadlineDuration,
        maxAckDeadline: ackDeadlineDuration,
      });
      pubsubLogger.info(
        { ackDeadlineSeconds: options.ackDeadline },
        "Ack deadline configured",
      );
    }

    this.subscription.on("message", messageHandler);
    this.subscription.on("error", (error: Error) => {
      pubsubLogger.error({ error }, "Subscription error");
    });

    this.activeSubscriptions.set(subscriptionName, this.subscription);

    return {
      name: subscriptionName,
      close: async () => {
        this.subscription.close();
        this.activeSubscriptions.delete(subscriptionName);
      },
    };
  }

  async close(): Promise<void> {
    for (const subscription of this.activeSubscriptions.values()) {
      subscription.close();
    }
    this.activeSubscriptions.clear();
    await this.client.close();
  }
}
