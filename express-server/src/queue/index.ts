import type { Env } from "../types/context";
import { GooglePubSubQueue } from "./providers/googlePubSub";
import type { Queue } from "./types";

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
