/**
 * Tests for model selection in the create route.
 *
 * Covers:
 * - Flag disabled: submitted model is ignored, pipeline uses DEFAULT_MODEL
 * - Flag enabled + valid model: pipeline uses the submitted model
 * - Flag enabled + invalid model: returns 400 with UNSUPPORTED_MODEL error
 * - Flag enabled + no model: pipeline uses DEFAULT_MODEL
 */

import type { RequestHandler } from "express";
import express from "express";
import request from "supertest";
import rateLimit from "express-rate-limit";
import { validateParsedData } from "tttc-common/csv-security";
import { ERROR_CODES } from "tttc-common/errors";
import type { SourceRow } from "tttc-common/schema";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { authMiddleware } from "../../middleware";
import create from "../create";

const { mockQueueEnqueue } = vi.hoisted(() => ({
  mockQueueEnqueue: vi.fn(),
}));

vi.mock("tttc-common/csv-security", () => ({
  validateParsedData: vi.fn(),
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
        id: "report-id-123",
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
    save: vi
      .fn()
      .mockResolvedValue({ tag: "success", value: "http://test-url.com" }),
  }),
}));

vi.mock("../../server", () => ({
  nodeWorkerQueue: {
    enqueue: mockQueueEnqueue,
  },
}));

vi.mock("../../featureFlags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(false),
}));

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

const minimalUserConfig = {
  title: "Test Report",
  description: "Test description",
  systemInstructions: "System",
  clusteringInstructions: "Clustering",
  extractionInstructions: "Extraction",
  dedupInstructions: "Dedup",
  summariesInstructions: "Summaries",
  cruxInstructions: "Crux",
  cruxesEnabled: false,
};

const sampleData: SourceRow[] = [
  { id: "1", comment: "A test comment", interview: "Alice" },
];

describe("Model selection in create route", () => {
  let app: express.Application;
  let mockFeatureFlags: { isFeatureEnabled: ReturnType<typeof vi.fn> };

  beforeAll(() => {
    app = express();
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
        },
      };
      req.log = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as unknown as typeof req.log;
      next();
    });

    app.post(
      "/create",
      authMiddleware(),
      rateLimiter,
      create as unknown as RequestHandler,
    );
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFeatureFlags = vi.mocked(await import("../../featureFlags/index.js"));
    mockFeatureFlags.isFeatureEnabled.mockResolvedValue(false);
    (validateParsedData as ReturnType<typeof vi.fn>).mockReturnValue({
      tag: "success",
      value: [],
    });
    mockQueueEnqueue.mockResolvedValue(undefined);
  });

  describe("flag disabled", () => {
    it("uses DEFAULT_MODEL when flag is disabled and model is provided", async () => {
      mockFeatureFlags.isFeatureEnabled.mockResolvedValue(false);

      await request(app)
        .post("/create")
        .set("Authorization", "Bearer valid-token")
        .send({
          userConfig: minimalUserConfig,
          data: ["csv", sampleData],
          model: "gpt-4o",
        })
        .expect(200);

      expect(mockQueueEnqueue).toHaveBeenCalledOnce();
      const enqueuedJob = mockQueueEnqueue.mock.calls[0][0];
      expect(enqueuedJob.config.llm.model).toBe("gpt-4o-mini");
    });

    it("uses DEFAULT_MODEL when flag is disabled and no model is provided", async () => {
      mockFeatureFlags.isFeatureEnabled.mockResolvedValue(false);

      await request(app)
        .post("/create")
        .set("Authorization", "Bearer valid-token")
        .send({
          userConfig: minimalUserConfig,
          data: ["csv", sampleData],
        })
        .expect(200);

      expect(mockQueueEnqueue).toHaveBeenCalledOnce();
      const enqueuedJob = mockQueueEnqueue.mock.calls[0][0];
      expect(enqueuedJob.config.llm.model).toBe("gpt-4o-mini");
    });
  });

  describe("flag enabled", () => {
    beforeEach(() => {
      mockFeatureFlags.isFeatureEnabled.mockResolvedValue(true);
    });

    it("uses the submitted model when flag is enabled and model is valid", async () => {
      await request(app)
        .post("/create")
        .set("Authorization", "Bearer valid-token")
        .send({
          userConfig: minimalUserConfig,
          data: ["csv", sampleData],
          model: "gpt-4o",
        })
        .expect(200);

      expect(mockQueueEnqueue).toHaveBeenCalledOnce();
      const enqueuedJob = mockQueueEnqueue.mock.calls[0][0];
      expect(enqueuedJob.config.llm.model).toBe("gpt-4o");
    });

    it("returns 400 with UNSUPPORTED_MODEL when flag is enabled and model is invalid", async () => {
      const response = await request(app)
        .post("/create")
        .set("Authorization", "Bearer valid-token")
        .send({
          userConfig: minimalUserConfig,
          data: ["csv", sampleData],
          model: "not-a-real-model",
        })
        .expect(400);

      expect(response.body.error.code).toBe(ERROR_CODES.UNSUPPORTED_MODEL);
      expect(mockQueueEnqueue).not.toHaveBeenCalled();
    });

    it("uses DEFAULT_MODEL when flag is enabled but no model is provided", async () => {
      await request(app)
        .post("/create")
        .set("Authorization", "Bearer valid-token")
        .send({
          userConfig: minimalUserConfig,
          data: ["csv", sampleData],
        })
        .expect(200);

      expect(mockQueueEnqueue).toHaveBeenCalledOnce();
      const enqueuedJob = mockQueueEnqueue.mock.calls[0][0];
      expect(enqueuedJob.config.llm.model).toBe("gpt-4o-mini");
    });
  });
});
