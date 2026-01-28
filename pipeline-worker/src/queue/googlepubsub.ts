import type {
  Message,
  PubSub,
  Subscription,
  Topic,
} from "@google-cloud/pubsub";
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
  ): Promise<PubSubSubscription> {
    const messageHandler = async (message: Message) => {
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
        pubsubLogger.error(
          { messageId: message.id, error: e },
          "Error processing message",
        );
        message.nack();
      }
    };

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
