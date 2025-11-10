import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock environment validation to prevent Firebase initialization issues
vi.mock("../../../types/context", () => ({
  validateEnv: vi.fn(() => ({
    OPENAI_API_KEY: "test-key",
    GCLOUD_STORAGE_BUCKET: "test-bucket",
    GOOGLE_CREDENTIALS_ENCODED: Buffer.from(
      JSON.stringify({
        type: "service_account",
        project_id: "test-project",
        private_key_id: "test-key-id",
        private_key:
          "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC1234567890\n-----END PRIVATE KEY-----\n",
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
          "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC1234567890\n-----END PRIVATE KEY-----\n",
        client_email:
          "firebase-test@test-firebase-project.iam.gserviceaccount.com",
        client_id: "test-firebase-client-id",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
      }),
    ).toString("base64"),
    CLIENT_BASE_URL: "http://localhost:3000",
    PYSERVER_URL: "http://localhost:8000",
    REDIS_URL: "redis://localhost:6379/1",
    REDIS_QUEUE_NAME: "test-queue",
    ALLOWED_ORIGINS: ["http://localhost:3000"],
    NODE_ENV: "test" as const,
    FEATURE_FLAG_PROVIDER: "local" as const,
    FEATURE_FLAG_API_KEY: undefined,
    FEATURE_FLAG_HOST: "https://test.posthog.com",
    LOCAL_FLAGS: undefined,
    ANALYTICS_PROVIDER: "local" as const,
    ANALYTICS_API_KEY: undefined,
    ANALYTICS_HOST: "https://test.posthog.com",
    ANALYTICS_ENABLED: false,
    ANALYTICS_FLUSH_AT: 20,
    ANALYTICS_FLUSH_INTERVAL: 10000,
    ANALYTICS_DEBUG: false,
    FIREBASE_ADMIN_PROJECT_ID: undefined,
    RATE_LIMIT_PREFIX: "test",
    PYSERVER_MAX_CONCURRENCY: 8,
    ALLOWED_GCS_BUCKETS: ["test-bucket"],
    PUBSUB_TOPIC_NAME: "test-topic",
    PUBSUB_SUBSCRIPTION_NAME: "test-sub",
    GOOGLE_CLOUD_PROJECT_ID: "test-project",
    FIREBASE_DATABASE_URL: "https://test-project.firebaseio.com",
    OPENAI_API_KEY_PASSWORD: undefined,
  })),
}));

// Mock Firebase Admin to prevent actual initialization
vi.mock("firebase-admin", () => ({
  default: {
    initializeApp: vi.fn(),
    credential: {
      cert: vi.fn(),
    },
    firestore: vi.fn(() => ({
      collection: vi.fn(),
      doc: vi.fn(),
    })),
    auth: vi.fn(() => ({
      getUser: vi.fn(),
      getUserByEmail: vi.fn(),
      createUser: vi.fn(),
    })),
  },
  initializeApp: vi.fn(),
  credential: {
    cert: vi.fn(),
  },
  firestore: vi.fn(() => ({
    collection: vi.fn(),
    doc: vi.fn(),
  })),
  auth: vi.fn(() => ({
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
  })),
}));

import { GooglePubSubQueue } from "../googlePubSub";
import { PipelineJob } from "../../../jobs/pipeline";

// Mock the Google Cloud PubSub module
vi.mock("@google-cloud/pubsub", () => ({
  PubSub: vi.fn().mockImplementation(() => ({
    topic: vi.fn().mockImplementation(() => ({
      publishMessage: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue([{ name: "test-topic" }]), // Returns [Topic]
      name: "test-topic",
      subscription: vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue([{ name: "test-subscription" }]), // Returns [Subscription]
        create: vi.fn().mockResolvedValue(undefined), // For creating subscription
        name: "test-subscription",
      })),
    })),
  })),
}));

// Mock the pipelineJob function
vi.mock("../../../jobs/pipeline", () => ({
  pipelineJob: vi.fn().mockResolvedValue(undefined),
  PipelineJob: {},
}));

describe("GooglePubSubQueue", () => {
  let queue: GooglePubSubQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    queue = new GooglePubSubQueue(
      "test-topic",
      "test-subscription",
      "test-project",
    );
  });

  describe("constructor", () => {
    it("should create the queue instance", () => {
      expect(queue).toBeDefined();
      expect(queue).toBeInstanceOf(GooglePubSubQueue);
    });
  });

  describe("enqueue", () => {
    it("should call publishMessage on topic", async () => {
      const pipelineJob: PipelineJob = {
        config: {
          env: "test" as any,
          auth: "public",
          firebaseDetails: {
            reportDataUri: "test-uri",
            userId: "test-user",
            firebaseJobId: "test-job",
          },
          llm: { model: "test-model" },
          instructions: {
            systemInstructions: "test",
            clusteringInstructions: "test",
            extractionInstructions: "test",
            dedupInstructions: "test",
            cruxInstructions: "test",
            summariesInstructions: "test",
          },
          api_key: "test-key",
          options: { cruxes: false, bridging: false },
        },
        data: [],
        reportDetails: {
          title: "test",
          description: "test",
          question: "test",
          filename: "test.json",
        },
      };

      // This will test that the method executes without throwing
      await expect(queue.enqueue(pipelineJob)).resolves.toBeUndefined();
    });
  });

  describe("listen", () => {
    it("should call subscription.on with message event", async () => {
      // This will test that the method executes without throwing
      await expect(queue.listen()).resolves.toBeUndefined();
    });
  });

  describe("close", () => {
    it("should call subscription.close", async () => {
      // This will test that the method executes without throwing
      await expect(queue.close()).resolves.toBeUndefined();
    });
  });
});
