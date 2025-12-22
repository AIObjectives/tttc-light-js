/**
 * Queue Failure Integration Test
 *
 * Tests that queue failures return errors to the client instead of
 * silently failing after sending a success response (T3C-891).
 */

import express from "express";
import request from "supertest";
import type { SourceRow } from "tttc-common/schema";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import create from "../create";

// Hoist mocks
const { mockStorageSave, mockQueueEnqueue } = vi.hoisted(() => ({
  mockStorageSave: vi.fn(),
  mockQueueEnqueue: vi.fn(),
}));

// Mock dependencies
vi.mock("tttc-common/csv-security", () => ({
  validateParsedData: vi.fn(() => ({ tag: "success", value: [] })),
  detectCSVInjection: vi.fn(() => false),
}));

vi.mock("../../Firebase", () => ({
  verifyUser: vi
    .fn()
    .mockResolvedValue({ uid: "test-user", email: "test@example.com" }),
  ensureUserDocument: vi.fn().mockResolvedValue(undefined),
  createReportJobAndRef: vi.fn().mockResolvedValue({
    jobId: "job-id-123",
    reportId: "report-id-123",
  }),
  updateReportJobDataUri: vi.fn().mockResolvedValue(undefined),
  updateReportRefDataUri: vi.fn().mockResolvedValue(undefined),
  db: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
      })),
    })),
  },
  getCollectionName: vi.fn((collection) => `test-${collection.toLowerCase()}`),
}));

vi.mock("../../storage", () => ({
  createStorage: vi.fn().mockReturnValue({
    save: mockStorageSave,
  }),
}));

vi.mock("../../server", () => ({
  pipelineQueue: {
    enqueue: mockQueueEnqueue,
  },
}));

describe("Queue Failure Handling (T3C-891)", () => {
  let app: express.Application;

  const validRequest = {
    firebaseAuthToken: "valid-token",
    userConfig: {
      title: "Test Report",
      description: "Test description",
      systemInstructions: "Test system",
      clusteringInstructions: "Test clustering",
      extractionInstructions: "Test extraction",
      dedupInstructions: "Test dedup",
      summariesInstructions: "Test summaries",
      cruxInstructions: "Test crux",
      cruxesEnabled: false,
    },
    data: ["csv", [{ id: "1", comment: "Test comment" }] as SourceRow[]],
  };

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Mock request context
    app.use((req, _res, next) => {
      req.context = {
        env: {
          OPENAI_API_KEY: "sk-test-key",
          CLIENT_BASE_URL: "http://localhost:3000",
          PYSERVER_URL: "http://localhost:8000",
          GCLOUD_STORAGE_BUCKET: "test-bucket",
          GOOGLE_CREDENTIALS_ENCODED: "test-google-creds",
          ALLOWED_GCS_BUCKETS: ["test-bucket"],
          FIREBASE_CREDENTIALS_ENCODED: "test-firebase-creds",
          REDIS_URL: "redis://localhost:6379",
          REDIS_QUEUE_NAME: "test-queue",
          ALLOWED_ORIGINS: ["http://localhost:3000"],
          NODE_ENV: "development" as const,
          FEATURE_FLAG_PROVIDER: "local" as const,
          FEATURE_FLAG_HOST: "https://us.i.posthog.com",
          ANALYTICS_PROVIDER: "local" as const,
          ANALYTICS_HOST: "https://app.posthog.com",
          ANALYTICS_ENABLED: false,
          ANALYTICS_FLUSH_AT: 20,
          ANALYTICS_FLUSH_INTERVAL: 10000,
          ANALYTICS_DEBUG: false,
          RATE_LIMIT_PREFIX: "test",
          PYSERVER_MAX_CONCURRENCY: 5,
          PUBSUB_TOPIC_NAME: "test-topic",
          PUBSUB_SUBSCRIPTION_NAME: "test-sub",
        },
      };
      req.log = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as any;
      next();
    });

    app.post("/create", create);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageSave.mockResolvedValue({
      tag: "success",
      value: "http://test-url.com",
    });
  });

  it("should return success when queue enqueue succeeds", async () => {
    mockQueueEnqueue.mockResolvedValue(undefined);

    const response = await request(app)
      .post("/create")
      .send(validRequest)
      .expect(200);

    expect(response.body.message).toBe("Request received.");
    expect(mockQueueEnqueue).toHaveBeenCalledTimes(1);
  });

  it("should return error when queue enqueue fails", async () => {
    mockQueueEnqueue.mockRejectedValue(new Error("Queue connection failed"));

    const response = await request(app)
      .post("/create")
      .send(validRequest)
      .expect(500);

    expect(response.body.error).toBeDefined();
    expect(mockQueueEnqueue).toHaveBeenCalledTimes(1);
  });

  it("should log error when queue enqueue fails", async () => {
    const queueError = new Error("Redis connection timeout");
    mockQueueEnqueue.mockRejectedValue(queueError);

    let loggedError: any;
    const customApp = express();
    customApp.use(express.json());
    customApp.use((req, _res, next) => {
      req.context = {
        env: {
          OPENAI_API_KEY: "sk-test-key",
          CLIENT_BASE_URL: "http://localhost:3000",
          PYSERVER_URL: "http://localhost:8000",
          GCLOUD_STORAGE_BUCKET: "test-bucket",
          GOOGLE_CREDENTIALS_ENCODED: "test-google-creds",
          ALLOWED_GCS_BUCKETS: ["test-bucket"],
          FIREBASE_CREDENTIALS_ENCODED: "test-firebase-creds",
          REDIS_URL: "redis://localhost:6379",
          REDIS_QUEUE_NAME: "test-queue",
          ALLOWED_ORIGINS: ["http://localhost:3000"],
          NODE_ENV: "development" as const,
          FEATURE_FLAG_PROVIDER: "local" as const,
          FEATURE_FLAG_HOST: "https://us.i.posthog.com",
          ANALYTICS_PROVIDER: "local" as const,
          ANALYTICS_HOST: "https://app.posthog.com",
          ANALYTICS_ENABLED: false,
          ANALYTICS_FLUSH_AT: 20,
          ANALYTICS_FLUSH_INTERVAL: 10000,
          ANALYTICS_DEBUG: false,
          RATE_LIMIT_PREFIX: "test",
          PYSERVER_MAX_CONCURRENCY: 5,
          PUBSUB_TOPIC_NAME: "test-topic",
          PUBSUB_SUBSCRIPTION_NAME: "test-sub",
        },
      };
      req.log = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn((obj, msg) => {
          loggedError = { obj, msg };
        }),
        debug: vi.fn(),
      } as any;
      next();
    });
    customApp.post("/create", create);

    await request(customApp).post("/create").send(validRequest).expect(500);

    expect(loggedError).toBeDefined();
    expect(loggedError.msg).toBe("Create report error");
    expect(loggedError.obj.error).toBe(queueError);
  });
});
