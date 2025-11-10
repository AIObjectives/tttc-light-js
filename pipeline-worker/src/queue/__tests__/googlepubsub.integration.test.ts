import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
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

  describe("enqueue and message publishing", () => {
    it("should publish and receive a message through the emulator", async () => {
      const testData = {
        id: "integration-test-1",
        value: 42,
        timestamp: Date.now(),
      };

      // Publish message
      const result = await pubsub.enqueue(testData);

      expect(result.messageId).toBeDefined();
      expect(typeof result.messageId).toBe("string");
    }, 10000);

    it("should handle multiple messages", async () => {
      const messages = [
        { id: "msg-1", value: 10, timestamp: Date.now() },
        { id: "msg-2", value: 20, timestamp: Date.now() + 1 },
        { id: "msg-3", value: 30, timestamp: Date.now() + 2 },
      ];

      // Publish multiple messages
      const results = await Promise.all(
        messages.map((msg) => pubsub.enqueue(msg)),
      );

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.messageId).toBeDefined();
        expect(typeof result.messageId).toBe("string");
      });
    }, 10000);
  });

  describe("subscribe and message consumption", () => {
    it("should subscribe and receive messages", async () => {
      const receivedMessages: Array<{
        id: string;
        value: number;
        timestamp: number;
      }> = [];
      const uniqueId = `subscription-test-${Date.now()}`;
      const testData = {
        id: uniqueId,
        value: 99,
        timestamp: Date.now(),
      };

      // Set up subscription handler that only processes our specific message
      const subscription = await pubsub.subscribe(
        subscriptionName,
        async (message) => {
          if (message.data.id === uniqueId) {
            receivedMessages.push(message.data);
          }
        },
      );

      // Publish a message
      await pubsub.enqueue(testData);

      // Wait for message to be processed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify our specific message was received
      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toEqual(testData);

      // Clean up subscription
      await subscription.close();
    }, 15000);

    it("should handle subscription lifecycle", async () => {
      const receivedMessages: any[] = [];
      const uniqueId1 = `lifecycle-test-${Date.now()}`;
      const uniqueId2 = `after-close-${Date.now()}`;

      // Create subscription that only processes our specific messages
      const subscription = await pubsub.subscribe(
        subscriptionName,
        async (message) => {
          if (message.data.id === uniqueId1 || message.data.id === uniqueId2) {
            receivedMessages.push(message.data);
          }
        },
      );

      expect(subscription.name).toBe(subscriptionName);

      // Publish a message
      await pubsub.enqueue({
        id: uniqueId1,
        value: 777,
        timestamp: Date.now(),
      });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Close subscription
      await subscription.close();

      // Publish another message - should not be received by our closed subscription
      await pubsub.enqueue({
        id: uniqueId2,
        value: 888,
        timestamp: Date.now(),
      });

      // Wait a bit more
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should only have received the first message
      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].id).toBe(uniqueId1);
    }, 15000);
  });

  describe("concurrent operations", () => {
    it("should handle concurrent publishing", async () => {
      const concurrentMessages = Array.from({ length: 10 }, (_, i) => ({
        id: `concurrent-${i}`,
        value: i * 10,
        timestamp: Date.now() + i,
      }));

      // Publish all messages concurrently
      const results = await Promise.allSettled(
        concurrentMessages.map((msg) => pubsub.enqueue(msg)),
      );

      // All should succeed
      const successful = results.filter((r) => r.status === "fulfilled");
      expect(successful).toHaveLength(10);
    }, 15000);
  });
});
