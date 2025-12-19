import type { PubSub } from "@google-cloud/pubsub";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { GooglePubSub } from "../googlepubsub";

const mockTopic = {
  subscription: vi.fn(),
  name: "test-topic",
};

const mockSubscription = {
  on: vi.fn(),
  close: vi.fn(),
  name: "test-subscription",
};

const mockPubSub = {
  topic: vi.fn(() => mockTopic),
  close: vi.fn(),
};

vi.mock("@google-cloud/pubsub", () => ({
  PubSub: vi.fn(() => mockPubSub),
}));

const TestSchema = z.object({
  id: z.string(),
  value: z.number(),
});

describe("GooglePubSub", () => {
  let pubsub: GooglePubSub<typeof TestSchema>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockTopic.subscription.mockReturnValue(mockSubscription);
    pubsub = new GooglePubSub(
      mockPubSub as unknown as PubSub,
      "test-topic",
      "test-subscription",
      TestSchema,
    );
  });

  afterEach(async () => {
    await pubsub.close();
    vi.restoreAllMocks();
  });

  describe("subscribe", () => {
    it("should create subscription and handle valid messages", async () => {
      const handler = vi.fn();
      const mockMessage = {
        id: "msg-123",
        data: Buffer.from(JSON.stringify({ id: "test-id", value: 42 })),
        attributes: { source: "test" },
        publishTime: "2023-01-01T00:00:00.000Z",
        ack: vi.fn(),
        nack: vi.fn(),
      };

      mockSubscription.on.mockImplementation(
        (event: string, callback: Function) => {
          if (event === "message") {
            setTimeout(() => callback(mockMessage), 0);
          }
        },
      );

      const subscription = await pubsub.subscribe("test-subscription", handler);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockTopic.subscription).toHaveBeenCalledWith("test-subscription");
      expect(mockSubscription.on).toHaveBeenCalledWith(
        "message",
        expect.any(Function),
      );
      expect(handler).toHaveBeenCalledWith({
        id: "msg-123",
        data: { id: "test-id", value: 42 },
        attributes: { source: "test" },
        publishTime: new Date("2023-01-01T00:00:00.000Z"),
      });
      expect(mockMessage.ack).toHaveBeenCalled();
      expect(subscription.name).toBe("test-subscription");
    });

    it("should nack messages with invalid data", async () => {
      const handler = vi.fn();

      const mockMessage = {
        id: "msg-123",
        data: Buffer.from(JSON.stringify({ invalid: "data" })),
        attributes: {},
        publishTime: "2023-01-01T00:00:00.000Z",
        ack: vi.fn(),
        nack: vi.fn(),
      };

      mockSubscription.on.mockImplementation(
        (event: string, callback: Function) => {
          if (event === "message") {
            setTimeout(() => callback(mockMessage), 0);
          }
        },
      );

      await pubsub.subscribe("test-subscription", handler);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).not.toHaveBeenCalled();
      expect(mockMessage.nack).toHaveBeenCalled();
    });

    it("should handle subscription close", async () => {
      const handler = vi.fn();
      const subscription = await pubsub.subscribe("test-subscription", handler);

      await subscription.close();

      expect(mockSubscription.close).toHaveBeenCalled();
    });
  });

  describe("close", () => {
    it("should close all active subscriptions and client", async () => {
      const handler = vi.fn();
      await pubsub.subscribe("sub-1", handler);
      await pubsub.subscribe("sub-2", handler);

      await pubsub.close();

      expect(mockSubscription.close).toHaveBeenCalledTimes(2);
      expect(mockPubSub.close).toHaveBeenCalled();
    });
  });
});
