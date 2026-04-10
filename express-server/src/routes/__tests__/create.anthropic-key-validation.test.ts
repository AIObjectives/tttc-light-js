/**
 * Tests for Anthropic API key validation at dispatch time.
 *
 * Verifies that submitting a job with an Anthropic model when
 * ANTHROPIC_API_KEY is absent returns an error immediately (before
 * enqueuing), and that the job proceeds normally when the key is present.
 */

import type { Request, RequestHandler } from "express";
import express from "express";
import request from "supertest";
import type { SourceRow } from "tttc-common/schema";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { authMiddleware } from "../../middleware";
import create from "../create";

// Hoist mocks so they are available in vi.mock factory functions
const { mockStorageSave, mockQueueEnqueue } = vi.hoisted(() => ({
  mockStorageSave: vi.fn(),
  mockQueueEnqueue: vi.fn(),
}));

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
        id: "test-report-id",
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
      })),
    })),
  },
  getCollectionName: vi.fn(
    (collection: string) => `test-${collection.toLowerCase()}`,
  ),
}));

vi.mock("../../storage", () => ({
  createStorage: vi.fn().mockReturnValue({
    save: mockStorageSave,
  }),
}));

vi.mock("../../server", () => ({
  nodeWorkerQueue: {
    enqueue: mockQueueEnqueue,
  },
}));

// Mock feature flags so that model selection is enabled (returning true
// allows the Anthropic model from the request body to be used)
vi.mock("../../featureFlags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}));

const validRequest = {
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
  model: "claude-sonnet-4-5",
};

/**
 * Build an Express app with a customizable env context.
 */
function buildApp(envOverrides: Record<string, unknown> = {}) {
  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    req.context = {
      env: {
        OPENAI_API_KEY: "sk-test-key",
        CLIENT_BASE_URL: "http://localhost:3000",
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
        PUBSUB_TOPIC_NAME: "test-topic",
        PUBSUB_SUBSCRIPTION_NAME: "test-sub",
        NODE_WORKER_TOPIC_NAME: "test-node-worker-topic",
        NODE_WORKER_SUBSCRIPTION_NAME: "test-node-worker-subscription",
        ...envOverrides,
      },
    };
    req.log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    } as unknown as Request["log"];
    next();
  });

  app.post("/create", authMiddleware(), create as unknown as RequestHandler);
  return app;
}

describe("Anthropic API key validation at dispatch time", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageSave.mockResolvedValue({
      tag: "success",
      value: "http://test-url.com",
    });
    mockQueueEnqueue.mockResolvedValue(undefined);
  });

  describe("when ANTHROPIC_API_KEY is absent", () => {
    let app: express.Application;

    beforeAll(() => {
      // Env has no ANTHROPIC_API_KEY (key is absent / undefined)
      app = buildApp({ ANTHROPIC_API_KEY: undefined });
    });

    it("returns 503 and does not enqueue the job", async () => {
      const response = await request(app)
        .post("/create")
        .set("Authorization", "Bearer valid-token")
        .send(validRequest)
        .expect(503);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe("SERVICE_UNAVAILABLE");
      expect(mockQueueEnqueue).not.toHaveBeenCalled();
    });

    it("does not expose internal env var names in the response", async () => {
      const response = await request(app)
        .post("/create")
        .set("Authorization", "Bearer valid-token")
        .send(validRequest)
        .expect(503);

      const bodyText = JSON.stringify(response.body);
      expect(bodyText).not.toContain("ANTHROPIC_API_KEY");
      expect(bodyText).not.toContain("OPENAI_API_KEY");
    });
  });

  describe("when ANTHROPIC_API_KEY is present", () => {
    let app: express.Application;

    beforeAll(() => {
      app = buildApp({ ANTHROPIC_API_KEY: "sk-ant-test-key" });
    });

    it("enqueues the job and returns 200", async () => {
      const response = await request(app)
        .post("/create")
        .set("Authorization", "Bearer valid-token")
        .send(validRequest)
        .expect(200);

      expect(response.body.message).toBe("Request received.");
      expect(mockQueueEnqueue).toHaveBeenCalledTimes(1);
    });
  });
});
