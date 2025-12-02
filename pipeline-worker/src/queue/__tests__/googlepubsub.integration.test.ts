import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { z } from "zod";
import { GooglePubSub } from "../googlepubsub";
import { createPubSubFactory } from "../index";

const TestSchema = z.object({
  id: z.string(),
  value: z.number(),
  timestamp: z.number(),
});

describe("GooglePubSub Integration Tests (Emulator)", () => {
  let pubsub: GooglePubSub<typeof TestSchema>;
  const topicName = `test-topic-${Date.now()}`;
  const subscriptionName = `test-subscription-${Date.now()}`;

  beforeAll(async () => {
    // Create PubSub factory configured for development (emulator)
    const factory = createPubSubFactory({
      node_env: "development",
      projectId: "dev-project",
      subscriptionName: subscriptionName,
    });

    // Initialize GooglePubSub instance using factory
    pubsub = await factory(topicName, TestSchema);
  });

  afterAll(async () => {
    // Clean up
    await pubsub?.close();
  });

  beforeEach(() => {
    // Add a small delay between tests to avoid conflicts
    return new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe("subscribe and message consumption", () => {
    it("should subscribe to subscription", async () => {
      const handler = vi.fn();

      // Set up subscription handler
      const subscription = await pubsub.subscribe(subscriptionName, handler);

      expect(subscription.name).toBe(subscriptionName);

      // Clean up subscription
      await subscription.close();
    }, 15000);
  });
});
