export * from "./googlepubsub";

import { GooglePubSub } from "./googlepubsub";
import { PubSub } from "@google-cloud/pubsub";

import { z } from "zod";

export interface PubSubMessage<T = unknown> {
  id: string;
  data: T;
  attributes?: Record<string, string>;
  publishTime: Date;
}

export interface PubSubSubscription {
  name: string;
  close(): Promise<void>;
}

export interface PubSubInterface<T extends z.ZodTypeAny = z.ZodTypeAny> {
  subscribe(
    subscriptionName: string,
    handler: (message: PubSubMessage<z.infer<T>>) => Promise<void> | void,
    options?: {
      maxMessages?: number;
      ackDeadline?: number;
      allowExcessMessages?: boolean;
    },
  ): Promise<PubSubSubscription>;

  close(): Promise<void>;
}

const envEnum = z.union([
  z.literal("production"),
  z.literal("development"),
  z.literal("test"),
]);

/**
 * Creates a factory function for making a pubsub client
 */
export const createPubSubFactory = ({
  node_env: _node_env,
  projectId: _projectId,
  subscriptionName: _subscriptionName,
}: {
  node_env: string | undefined;
  projectId: string | undefined;
  subscriptionName: string | undefined;
}) => {
  /**
   * Parse inputs since these might be undefined
   */
  const node_env = envEnum.parse(_node_env);
  const projectId = z.string().parse(_projectId);
  const subscriptionName = z.string().parse(_subscriptionName);

  /**
   * If we're in production, return a normal google pubsub
   *
   * In the future, we can extend this to return different types of pubsubs if needed
   */
  if (node_env === "production") {
    const client = new PubSub({
      projectId,
    });
    /**
     * Function that returns a google pubsub
     */
    return async <T extends z.ZodTypeAny>(topicName: string, schema: T) =>
      new GooglePubSub(client, topicName, subscriptionName, schema);
  } else {
    /**
     * If we're in development or test, connect to the pubsub emulator.
     */
    const client = new PubSub({
      projectId: "dev-project",
      apiEndpoint: "localhost:8085",
    });
    return async <T extends z.ZodTypeAny>(topicName: string, schema: T) => {
      /**
       * Create the topic and subscription to be used and return the pubsub
       */
      const [topic] = await client.topic(topicName).get({ autoCreate: true });
      await topic.subscription(subscriptionName).get({ autoCreate: true });
      const pubsub = new GooglePubSub(
        client,
        topicName,
        subscriptionName,
        schema,
      );
      return pubsub;
    };
  }
};

/**
 * Interface containing our pubsub services
 */
export interface PubSubServices {
  // TODO
  placeholder: PubSubInterface<any>;
}

/**
 * Function that creates all of our pubsub services
 */
export const PubSubServicesLive = async (env: {
  [key: string]: string | undefined;
}): Promise<PubSubServices> => {
  const factory = createPubSubFactory({
    node_env: env["NODE_ENV"],
    projectId: env["PUBSUB_PROJECT_ID"],
    subscriptionName: env["SUBSCRIPTION_NAME"],
  });

  return {
    placeholder: await factory("placeholder", z.any()),
  };
};
