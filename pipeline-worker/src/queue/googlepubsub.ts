import { PubSub, Subscription, Message, Topic } from "@google-cloud/pubsub";
import { z } from "zod";
import type { PubSubInterface, PubSubMessage, PubSubSubscription } from ".";

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
        console.error(`Error processing message ${message.id}:`, e);
        message.nack();
      }
    };

    this.subscription.on("message", messageHandler);
    this.subscription.on("error", (error: Error) => {
      console.error("Subscription error:", error);
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
