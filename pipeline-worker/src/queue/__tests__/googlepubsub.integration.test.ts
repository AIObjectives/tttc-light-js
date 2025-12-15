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
import { PubSub } from "@google-cloud/pubsub";
import { GooglePubSub } from "../googlepubsub";
import { createPubSubFactory } from "../index";

const TestSchema = z.object({
  id: z.string(),
  value: z.number(),
  timestamp: z.number(),
});

/**
 * Check if PubSub emulator is available
 */
async function isPubSubEmulatorAvailable(): Promise<boolean> {
  try {
    const testClient = new PubSub({
      projectId: "test-project",
      apiEndpoint: "localhost:8085",
    });

    // Try to list topics as a connectivity check with a short timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Timeout")), 2000);
    });

    await Promise.race([testClient.getTopics(), timeoutPromise]);

    await testClient.close();
    return true;
  } catch {
    return false;
  }
}

// PubSub emulator availability will be checked in beforeAll
let emulatorAvailable = false;

describe("GooglePubSub Integration Tests (Emulator)", () => {
  let pubsub: GooglePubSub<typeof TestSchema>;
  const topicName = `test-topic-${Date.now()}`;
  const subscriptionName = `test-subscription-${Date.now()}`;

  beforeAll(async () => {
    // Check if PubSub emulator is available
    emulatorAvailable = await isPubSubEmulatorAvailable();

    if (!emulatorAvailable) {
      console.warn(
        "\n⚠️  GooglePubSub Integration Tests Skipped: PubSub emulator is not available at localhost:8085\n" +
          "To run integration tests, ensure the PubSub emulator is running.\n" +
          "Start it with: gcloud beta emulators pubsub start --port=8085\n",
      );
      return;
    }

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
    if (!emulatorAvailable) {
      return;
    }

    // Clean up
    try {
      await pubsub?.close();
    } catch (error) {
      console.error("Error closing PubSub connection:", error);
    }
  });

  beforeEach(() => {
    if (!emulatorAvailable) {
      return;
    }
    // Add a small delay between tests to avoid conflicts
    return new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe("subscribe and message consumption", () => {
    it("should subscribe to subscription", async () => {
      if (!emulatorAvailable) return;

      const handler = vi.fn();

      // Set up subscription handler
      const subscription = await pubsub.subscribe(subscriptionName, handler);

      expect(subscription.name).toBe(subscriptionName);

      // Clean up subscription
      await subscription.close();
    }, 15000);
  });
});
