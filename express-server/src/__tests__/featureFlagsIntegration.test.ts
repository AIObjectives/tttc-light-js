import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
  vi,
} from "vitest";
import express from "express";
import request from "supertest";
import { Server } from "http";
import {
  initializeFeatureFlags,
  shutdownFeatureFlags,
  isFeatureEnabled,
  getFeatureFlag,
  getAllFeatureFlags,
  getFeatureFlagProvider,
} from "../featureFlags";
import { validateEnv } from "../types/context";
import { contextMiddleware } from "../middleware";

// Helper function to create mock environment for feature flag tests
const createMockEnv = (
  provider = "local",
  apiKey?: string,
  localFlags?: Record<string, boolean | string | number>,
  host?: string,
) => ({
  FEATURE_FLAG_PROVIDER: provider as "local" | "posthog",
  FEATURE_FLAG_API_KEY: apiKey,
  FEATURE_FLAG_HOST: host || "https://test.posthog.com",
  LOCAL_FLAGS: localFlags,
  // Add other required env properties with defaults
  OPENAI_API_KEY: "test-key",
  GCLOUD_STORAGE_BUCKET: "test-bucket",
  GOOGLE_CREDENTIALS_ENCODED: "test-encoded-creds",
  FIREBASE_CREDENTIALS_ENCODED: "test-firebase-creds",
  CLIENT_BASE_URL: "http://localhost:3000",
  PYSERVER_URL: "http://localhost:8000",
  NODE_ENV: "development" as const,
  REDIS_URL: "redis://localhost:6379",
  ALLOWED_GCS_BUCKETS: ["test-bucket"],
  REDIS_QUEUE_NAME: "test-queue",
  ALLOWED_ORIGINS: ["http://localhost:3000"],
  ANALYTICS_PROVIDER: "local" as const,
  ANALYTICS_API_KEY: undefined,
  ANALYTICS_HOST: "https://app.posthog.com",
  ANALYTICS_FLUSH_AT: 20,
  ANALYTICS_FLUSH_INTERVAL: 10000,
  ANALYTICS_ENABLED: false,
  ANALYTICS_DEBUG: false,
  FIREBASE_ADMIN_PROJECT_ID: undefined,
  RATE_LIMIT_PREFIX: "test",
  PYSERVER_MAX_CONCURRENCY: 5,
});

// Mock validateEnv to return a valid test environment
vi.mock("../types/context", () => ({
  validateEnv: vi.fn(() => ({
    OPENAI_API_KEY: "test-key",
    GCLOUD_STORAGE_BUCKET: "test-bucket",
    GOOGLE_CREDENTIALS_ENCODED: "test-encoded-creds",
    FIREBASE_CREDENTIALS_ENCODED: "test-encoded-firebase-creds",
    CLIENT_BASE_URL: "http://localhost:3000",
    PYSERVER_URL: "http://localhost:8000",
    REDIS_URL: "redis://localhost:6379/1",
    REDIS_QUEUE_NAME: "test-queue",
    ALLOWED_ORIGINS: ["http://localhost:3000"],
    NODE_ENV: "test",
    FEATURE_FLAG_PROVIDER: "local",
    FEATURE_FLAG_API_KEY: undefined,
    FEATURE_FLAG_HOST: "https://test.posthog.com",
    LOCAL_FLAGS: undefined,
  })),
}));

// Mock contextMiddleware to avoid dependency issues
vi.mock("../middleware", () => ({
  contextMiddleware: vi.fn(() => (req: any, res: any, next: any) => next()),
}));

// Mock PostHog to avoid external dependencies in integration tests
const mockPostHogInstance = {
  isFeatureEnabled: vi.fn(),
  getFeatureFlag: vi.fn(),
  getAllFlags: vi.fn(),
  shutdown: vi.fn(),
};

vi.mock("posthog-node", () => {
  return {
    PostHog: vi.fn().mockImplementation(() => mockPostHogInstance),
  };
});

// Mock logger
const { mockChildLogger } = vi.hoisted(() => ({
  mockChildLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("tttc-common/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => mockChildLogger),
  },
}));

// Mock Firebase to avoid initialization issues
vi.mock("firebase-admin", () => ({
  default: {
    initializeApp: vi.fn(),
    credential: {
      cert: vi.fn(),
    },
    apps: [],
  },
  initializeApp: vi.fn(),
  credential: {
    cert: vi.fn(),
  },
  apps: [],
}));

// Mock Google Cloud Storage
vi.mock("@google-cloud/storage", () => ({
  Storage: vi.fn().mockImplementation(() => ({
    bucket: vi.fn(),
  })),
}));

describe("Feature Flags Integration Tests", () => {
  const originalEnv = process.env;
  let app: express.Application;
  let server: Server;

  beforeAll(() => {
    // Set up test environment with all required variables
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      OPENAI_API_KEY: "test-key",
      GCLOUD_STORAGE_BUCKET: "test-bucket",
      GOOGLE_CREDENTIALS_ENCODED: Buffer.from(
        JSON.stringify({
          type: "service_account",
          project_id: "test-project",
          private_key_id: "test-key-id",
          private_key:
            "-----BEGIN PRIVATE KEY-----\ntest-private-key\n-----END PRIVATE KEY-----\n",
          client_email: "test@test-project.iam.gserviceaccount.com",
          client_id: "test-client-id",
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
        }),
      ).toString("base64"),
      FIREBASE_CREDENTIALS_ENCODED: Buffer.from(
        JSON.stringify({
          type: "service_account",
          project_id: "test-firebase-project",
          private_key_id: "test-firebase-key-id",
          private_key:
            "-----BEGIN PRIVATE KEY-----\ntest-firebase-private-key\n-----END PRIVATE KEY-----\n",
          client_email:
            "firebase-test@test-firebase-project.iam.gserviceaccount.com",
          client_id: "test-firebase-client-id",
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
        }),
      ).toString("base64"),
      CLIENT_BASE_URL: "http://localhost:3000",
      PYSERVER_URL: "http://localhost:8000",
      REDIS_URL: "redis://localhost:6379/1", // Use test DB
      REDIS_QUEUE_NAME: "test-queue",
      ALLOWED_ORIGINS: "http://localhost:3000",
    };
  });

  afterAll(async () => {
    // Restore environment
    process.env = originalEnv;

    // Ensure server is closed
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  beforeEach(async () => {
    // Clean up any existing feature flag provider
    await shutdownFeatureFlags();

    // Create fresh Express app for each test
    app = express();
    app.use(express.json());

    // Add context middleware (feature flags may depend on this)
    const env = validateEnv();
    app.use(contextMiddleware(env));

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await shutdownFeatureFlags();
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe("Local Provider Integration", () => {
    beforeEach(() => {
      // Initialize with local provider
      const mockEnv = validateEnv();
      initializeFeatureFlags({
        ...mockEnv,
        FEATURE_FLAG_PROVIDER: "local" as const,
        LOCAL_FLAGS: {
          "test-feature": true,
          "experimental-ui": false,
          "beta-analytics": true,
          "string-variant": "version-a",
          "numeric-config": 42,
        },
      });

      // Add test routes that use feature flags
      app.get("/test-feature-enabled", async (req, res) => {
        try {
          const enabled = await isFeatureEnabled("test-feature");
          res.json({ enabled });
        } catch (error) {
          res.status(500).json({ error: "Failed to check feature flag" });
        }
      });

      app.get("/feature/:flagName", async (req, res) => {
        try {
          const value = await getFeatureFlag(req.params.flagName);
          res.json({ flagName: req.params.flagName, value });
        } catch (error) {
          res.status(500).json({ error: "Failed to get feature flag" });
        }
      });

      app.get("/all-features", async (req, res) => {
        try {
          const flags = await getAllFeatureFlags();
          res.json({ flags });
        } catch (error) {
          res.status(500).json({ error: "Failed to get all feature flags" });
        }
      });

      app.get("/conditional-feature", async (req, res) => {
        const showNewUI = await isFeatureEnabled("experimental-ui");
        const showBetaAnalytics = await isFeatureEnabled("beta-analytics");

        res.json({
          ui: showNewUI ? "new-ui" : "legacy-ui",
          analytics: showBetaAnalytics
            ? "beta-analytics"
            : "standard-analytics",
          message: showNewUI
            ? "Welcome to our new interface!"
            : "You are using the classic interface.",
        });
      });

      server = app.listen(0); // Use random available port
    });

    it("should integrate feature flags with express routes", async () => {
      const response = await request(app)
        .get("/test-feature-enabled")
        .expect(200);

      expect(response.body).toEqual({ enabled: true });
    });

    it("should handle disabled features in routes", async () => {
      const response = await request(app)
        .get("/feature/experimental-ui")
        .expect(200);

      expect(response.body).toEqual({
        flagName: "experimental-ui",
        value: false,
      });
    });

    it("should return string variants correctly", async () => {
      const response = await request(app)
        .get("/feature/string-variant")
        .expect(200);

      expect(response.body).toEqual({
        flagName: "string-variant",
        value: "version-a",
      });
    });

    it("should handle non-existent features", async () => {
      const response = await request(app)
        .get("/feature/non-existent")
        .expect(200);

      expect(response.body).toEqual({
        flagName: "non-existent",
        value: null,
      });
    });

    it("should return all features via API", async () => {
      const response = await request(app).get("/all-features").expect(200);

      expect(response.body.flags).toEqual({
        "test-feature": true,
        "experimental-ui": false,
        "beta-analytics": true,
        "string-variant": "version-a",
        "numeric-config": 42,
      });
    });

    it("should conditionally render content based on multiple flags", async () => {
      const response = await request(app)
        .get("/conditional-feature")
        .expect(200);

      expect(response.body).toEqual({
        ui: "legacy-ui", // experimental-ui is false
        analytics: "beta-analytics", // beta-analytics is true
        message: "You are using the classic interface.",
      });
    });

    it("should maintain feature flag state across multiple requests", async () => {
      // First request
      const response1 = await request(app)
        .get("/test-feature-enabled")
        .expect(200);
      expect(response1.body.enabled).toBe(true);

      // Second request - should maintain same state
      const response2 = await request(app)
        .get("/test-feature-enabled")
        .expect(200);
      expect(response2.body.enabled).toBe(true);

      // Third request with different flag
      const response3 = await request(app)
        .get("/feature/experimental-ui")
        .expect(200);
      expect(response3.body.value).toBe(false);
    });

    it("should handle concurrent feature flag requests", async () => {
      const requests = Array(10)
        .fill(null)
        .map(() => request(app).get("/test-feature-enabled"));

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.enabled).toBe(true);
      });
    });
  });

  describe("PostHog Provider Integration", () => {
    // These tests use mocked PostHog - no actual API calls are made
    beforeEach(() => {
      // Set up PostHog mocks
      mockPostHogInstance.isFeatureEnabled.mockResolvedValue(true);
      mockPostHogInstance.getFeatureFlag.mockResolvedValue("posthog-variant");
      mockPostHogInstance.getAllFlags.mockResolvedValue({
        "posthog-feature": true,
        "posthog-variant": "test-value",
      });

      // Initialize with PostHog provider
      const mockEnv = validateEnv();
      initializeFeatureFlags({
        ...mockEnv,
        FEATURE_FLAG_PROVIDER: "posthog" as const,
        FEATURE_FLAG_API_KEY: "test-posthog-key",
        FEATURE_FLAG_HOST: "https://test.posthog.com",
      });

      // Add test route with context
      app.post("/feature-check", async (req, res) => {
        try {
          const { flagName, context } = req.body;
          const enabled = await isFeatureEnabled(flagName, context);
          res.json({ flagName, enabled, provider: "posthog" });
        } catch (error) {
          res.status(500).json({ error: "Failed to check PostHog feature" });
        }
      });

      server = app.listen(0);
    });

    it("should integrate PostHog provider with express routes", async () => {
      const response = await request(app)
        .post("/feature-check")
        .send({
          flagName: "test-posthog-feature",
          context: {
            userId: "user123",
            properties: { plan: "premium" },
          },
        })
        .expect(200);

      expect(response.body).toEqual({
        flagName: "test-posthog-feature",
        enabled: true,
        provider: "posthog",
      });

      expect(mockPostHogInstance.isFeatureEnabled).toHaveBeenCalledWith(
        "test-posthog-feature",
        "user123",
        {
          groups: undefined,
          personProperties: { plan: "premium" },
        },
      );
    });

    it("should handle PostHog API errors gracefully", async () => {
      mockPostHogInstance.isFeatureEnabled.mockRejectedValue(
        new Error("PostHog API down"),
      );

      const response = await request(app)
        .post("/feature-check")
        .send({
          flagName: "error-prone-feature",
          context: { userId: "user456" },
        })
        .expect(200);

      expect(response.body.enabled).toBe(false);
    });
  });

  describe("Feature Flag Initialization Integration", () => {
    it("should handle initialization with empty local flags", () => {
      expect(() => {
        initializeFeatureFlags(createMockEnv("local", undefined, {}));
      }).not.toThrow();

      const provider = getFeatureFlagProvider();
      expect(provider).not.toBeNull();
    });

    it("should prevent re-initialization", () => {
      const provider1 = initializeFeatureFlags(
        createMockEnv("local", undefined, { flag1: true }),
      );

      // Attempt to re-initialize should return the same provider
      const provider2 = initializeFeatureFlags(
        createMockEnv("local", undefined, { flag2: false }),
      );

      expect(provider1).toBe(provider2);
    });

    it("should throw error for invalid provider", () => {
      expect(() => {
        const mockEnv = validateEnv();
        initializeFeatureFlags({
          ...mockEnv,
          FEATURE_FLAG_PROVIDER: "invalid-provider" as any,
        });
      }).toThrow("Unknown feature flag provider: invalid-provider");
    });

    it("should require API key for PostHog provider", () => {
      // This test uses mocks - no actual PostHog API calls are made
      expect(() => {
        const mockEnv = validateEnv();
        initializeFeatureFlags({
          ...mockEnv,
          FEATURE_FLAG_PROVIDER: "posthog" as const,
          FEATURE_FLAG_API_KEY: undefined,
        });
      }).toThrow("PostHog API key is required for PostHog provider");
    });
  });

  describe("Graceful Shutdown Integration", () => {
    it("should shutdown local provider gracefully", async () => {
      initializeFeatureFlags(createMockEnv("local", undefined, { test: true }));

      expect(getFeatureFlagProvider()).not.toBeNull();

      await shutdownFeatureFlags();

      expect(getFeatureFlagProvider()).toBeNull();
    });

    it("should shutdown PostHog provider gracefully", async () => {
      // This test uses mocks - no actual PostHog API calls are made
      const mockEnv = validateEnv();
      initializeFeatureFlags({
        ...mockEnv,
        FEATURE_FLAG_PROVIDER: "posthog" as const,
        FEATURE_FLAG_API_KEY: "test-key",
      });

      expect(getFeatureFlagProvider()).not.toBeNull();

      await shutdownFeatureFlags();

      expect(mockPostHogInstance.shutdown).toHaveBeenCalled();
      expect(getFeatureFlagProvider()).toBeNull();
    });

    it("should handle shutdown when not initialized", async () => {
      expect(getFeatureFlagProvider()).toBeNull();

      // Should not throw
      await expect(shutdownFeatureFlags()).resolves.toBeUndefined();

      expect(getFeatureFlagProvider()).toBeNull();
    });

    it("should handle shutdown errors gracefully", async () => {
      // This test uses mocks - no actual PostHog API calls are made
      mockPostHogInstance.shutdown.mockRejectedValue(
        new Error("Shutdown failed"),
      );

      const mockEnv = validateEnv();
      initializeFeatureFlags({
        ...mockEnv,
        FEATURE_FLAG_PROVIDER: "posthog" as const,
        FEATURE_FLAG_API_KEY: "test-key",
      });

      // Should not throw despite PostHog shutdown error
      await expect(shutdownFeatureFlags()).resolves.toBeUndefined();

      expect(getFeatureFlagProvider()).toBeNull();
    });

    it("should allow re-initialization after shutdown", async () => {
      // Initialize
      const provider1 = initializeFeatureFlags(
        createMockEnv("local", undefined, { test1: true }),
      );

      // Shutdown
      await shutdownFeatureFlags();
      expect(getFeatureFlagProvider()).toBeNull();

      // Re-initialize
      const provider2 = initializeFeatureFlags(
        createMockEnv("local", undefined, { test2: false }),
      );

      expect(provider2).not.toBe(provider1);
      expect(getFeatureFlagProvider()).toBe(provider2);
    });
  });

  describe("Error Handling Integration", () => {
    beforeEach(() => {
      app.get("/error-prone-route", async (req, res) => {
        try {
          // Test various error conditions
          const feature1 = await isFeatureEnabled("test-feature");
          const feature2 = await getFeatureFlag("test-feature");
          const allFeatures = await getAllFeatureFlags();

          res.json({ feature1, feature2, allFeatures });
        } catch (error) {
          res.status(500).json({
            error: "Route error",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      });

      server = app.listen(0);
    });

    it("should handle uninitialized feature flags in routes", async () => {
      // Don't initialize feature flags
      const response = await request(app).get("/error-prone-route").expect(200);

      expect(response.body).toEqual({
        feature1: false,
        feature2: null,
        allFeatures: {},
      });
    });

    it("should handle feature flag errors without crashing the route", async () => {
      const mockEnv = validateEnv();
      initializeFeatureFlags({
        ...mockEnv,
        FEATURE_FLAG_PROVIDER: "local" as const,
        LOCAL_FLAGS: { "test-feature": true },
      });

      const response = await request(app).get("/error-prone-route").expect(200);

      expect(response.body.feature1).toBe(true);
      expect(response.body.feature2).toBe(true);
      expect(response.body.allFeatures).toEqual({ "test-feature": true });
    });
  });

  describe("Context Integration", () => {
    beforeEach(() => {
      const mockEnv = validateEnv();
      initializeFeatureFlags({
        ...mockEnv,
        FEATURE_FLAG_PROVIDER: "local" as const,
        LOCAL_FLAGS: {
          "context-feature": true,
          "user-specific-feature": false,
        },
      });

      app.post("/context-test", async (req, res) => {
        const { flagName, context } = req.body;

        const enabled = await isFeatureEnabled(flagName, context);
        const value = await getFeatureFlag(flagName, context);
        const allFlags = await getAllFeatureFlags(context);

        res.json({ enabled, value, allFlags, context });
      });

      server = app.listen(0);
    });

    it("should pass context through feature flag checks", async () => {
      const context = {
        userId: "test-user-123",
        email: "test@example.com",
        properties: { plan: "enterprise", region: "us-east" },
        groups: { company: "test-company" },
      };

      const response = await request(app)
        .post("/context-test")
        .send({
          flagName: "context-feature",
          context,
        })
        .expect(200);

      expect(response.body.enabled).toBe(true);
      expect(response.body.value).toBe(true);
      expect(response.body.allFlags).toEqual({
        "context-feature": true,
        "user-specific-feature": false,
      });
      expect(response.body.context).toEqual(context);
    });

    it("should handle empty context", async () => {
      const response = await request(app)
        .post("/context-test")
        .send({
          flagName: "context-feature",
          context: {},
        })
        .expect(200);

      expect(response.body.enabled).toBe(true);
      expect(response.body.context).toEqual({});
    });

    it("should handle missing context", async () => {
      const response = await request(app)
        .post("/context-test")
        .send({
          flagName: "context-feature",
          // No context provided
        })
        .expect(200);

      expect(response.body.enabled).toBe(true);
      expect(response.body.context).toBeUndefined();
    });
  });
});
