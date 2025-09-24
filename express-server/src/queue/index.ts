import { Queue } from "./types";
import { GooglePubSubQueue } from "./providers/googlePubSub";
import { Env } from "../types/context";

export function createQueue(env: Env): Queue {
  // Create GooglePubSub queue using new environment variables
  // In development, this will automatically use the Pub/Sub emulator
  return new GooglePubSubQueue(
    env.PUBSUB_TOPIC_NAME,
    env.PUBSUB_SUBSCRIPTION_NAME,
    env.GOOGLE_CLOUD_PROJECT_ID,
  );
}

export * from "./types";
