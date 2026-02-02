/**
 * Tests for email verification error handling in the create route
 */

import type { RequestHandler } from "express";
import express from "express";
import request from "supertest";
import {
  detectCSVInjection,
  validateParsedData,
} from "tttc-common/csv-security";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as firebase from "../../Firebase";
import { authMiddleware } from "../../middleware";
import create from "../create";

vi.mock("tttc-common/csv-security", () => ({
  validateParsedData: vi.fn(),
  detectCSVInjection: vi.fn(),
}));

vi.mock("../../Firebase", () => ({
  verifyUser: vi.fn(),
  ensureUserDocument: vi.fn().mockResolvedValue(undefined),
  addReportJob: vi.fn().mockResolvedValue("job-id-123"),
  addReportRef: vi.fn().mockResolvedValue("job-id-123"),
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
  getCollectionName: vi.fn((collection) => `test-${collection.toLowerCase()}`),
  admin: {
    firestore: vi.fn(),
  },
}));

vi.mock("../../storage", () => ({
  createStorage: vi.fn().mockReturnValue({
    save: vi
      .fn()
      .mockResolvedValue({ tag: "success", value: "http://test-url.com" }),
  }),
}));

vi.mock("../../server", () => ({
  pipelineQueue: {
    enqueue: vi.fn(),
  },
  nodeWorkerQueue: null,
}));

describe("Email Verification in Create Route", () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Mock request context with minimal test env
    app.use((req, _res, next) => {
      req.context = {
        env: {
          OPENAI_API_KEY: "sk-test-key-123",
          CLIENT_BASE_URL: "http://localhost:3000",
          PYSERVER_URL: "http://localhost:8000",
          GCLOUD_STORAGE_BUCKET: "test-bucket",
          GOOGLE_CREDENTIALS_ENCODED: "test-google-credentials",
          ALLOWED_GCS_BUCKETS: ["test-bucket"],
          FIREBASE_CREDENTIALS_ENCODED: "test-firebase-credentials",
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
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        fatal: vi.fn(),
        child: vi.fn(),
        level: "info",
        silent: false,
      } as any;

      mockLogger.child.mockReturnValue(mockLogger);
      req.log = mockLogger;
      next();
    });

    app.post("/create", authMiddleware(), create as unknown as RequestHandler);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default security mocks - allow data through
    (validateParsedData as any).mockReturnValue({
      tag: "success",
      value: [],
    });
    (detectCSVInjection as any).mockReturnValue(false);
  });

  const createValidRequestBody = (csvData: any[]) => ({
    userConfig: {
      title: "Test Report",
      description: "Test Description",
      systemInstructions: "Test System",
      clusteringInstructions: "Test Clustering",
      extractionInstructions: "Test Extraction",
      dedupInstructions: "Test Dedup",
      summariesInstructions: "Test Summaries",
      cruxInstructions: "Test Crux",
      cruxesEnabled: false,
    },
    data: ["csv", csvData],
  });

  it("should return AUTH_EMAIL_NOT_VERIFIED error for unverified email/password users", async () => {
    // Mock an email/password user with unverified email
    vi.mocked(firebase.verifyUser).mockResolvedValue({
      uid: "test-user",
      email: "test@example.com",
      email_verified: false,
      firebase: {
        sign_in_provider: "password",
        identities: {
          email: ["test@example.com"],
        },
      },
    } as any);

    const cleanData = [
      { comment: "Test comment", id: "1", interview: "Alice" },
    ];

    const response = await request(app)
      .post("/create")
      .set("Authorization", "Bearer valid-token")
      .send(createValidRequestBody(cleanData))
      .expect(403); // AUTH_EMAIL_NOT_VERIFIED returns 403

    expect(response.body.error.code).toBe("AUTH_EMAIL_NOT_VERIFIED");
    expect(response.body.error.message).toBe(
      "Please verify your email address to continue. Check your inbox for a verification link.",
    );
  });

  // Test cases for users who SHOULD be allowed to create reports
  describe("allowed user scenarios", () => {
    const testCases = [
      {
        name: "verified email/password user",
        user: {
          uid: "test-user",
          email: "test@example.com",
          email_verified: true,
          firebase: {
            sign_in_provider: "password",
            identities: { email: ["test@example.com"] },
          },
        },
      },
      {
        name: "Google OAuth user",
        user: {
          uid: "test-user",
          email: "test@gmail.com",
          email_verified: true,
          firebase: {
            sign_in_provider: "google.com",
            identities: {
              "google.com": ["123456789"],
              email: ["test@gmail.com"],
            },
          },
        },
      },
      {
        name: "legacy token without provider info",
        user: {
          uid: "test-user",
          email: "test@example.com",
        },
      },
    ];

    it.each(testCases)("should allow $name to create reports", async ({
      user,
    }) => {
      vi.mocked(firebase.verifyUser).mockResolvedValue(user as any);

      const response = await request(app)
        .post("/create")
        .set("Authorization", "Bearer valid-token")
        .send(
          createValidRequestBody([
            { comment: "Test", id: "1", interview: "Alice" },
          ]),
        )
        .expect(200);

      expect(response.body.message).toBe("Request received.");
    });
  });
});
