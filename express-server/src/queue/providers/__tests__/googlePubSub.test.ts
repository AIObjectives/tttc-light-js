import { beforeEach, describe, expect, it, vi } from "vitest";

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

import type { PipelineJob } from "../../../jobs/pipeline";
import { GooglePubSubQueue } from "../googlePubSub";

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

// Mock workers module for message handler tests
const mockProcessJob = vi.fn();
const mockProcessJobFailure = vi.fn();
vi.mock("../../../workers", () => ({
  processJob: (job: PipelineJob) => mockProcessJob(job),
  processJobFailure: (job: PipelineJob, error: Error) =>
    mockProcessJobFailure(job, error),
}));

// Mock Firebase getReportRefById for idempotency checks
const mockGetReportRefById = vi.fn();
vi.mock("../../../Firebase", async () => {
  const actual =
    await vi.importActual<typeof import("../../../Firebase")>(
      "../../../Firebase",
    );
  return {
    ...actual,
    getReportRefById: (reportId: string) => mockGetReportRefById(reportId),
  };
});

// Helper to create a mock PipelineJob
function createMockPipelineJob(): PipelineJob {
  return {
    config: {
      env: "test" as unknown as PipelineJob["config"]["env"],
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
}

describe("GooglePubSubQueue", () => {
  let queue: GooglePubSubQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessJob.mockReset();
    mockProcessJobFailure.mockReset();
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

describe("GooglePubSubQueue message handling", () => {
  // These tests require a more detailed mock setup to capture and invoke
  // the message handler callback

  let messageHandler:
    | ((message: {
        id: string;
        data: Buffer;
        ack: () => void;
        nack: () => void;
      }) => Promise<void>)
    | undefined;
  let mockAck: ReturnType<typeof vi.fn>;
  let mockNack: ReturnType<typeof vi.fn>;
  let mockSubscriptionOn: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockProcessJob.mockReset();
    mockProcessJobFailure.mockReset();
    mockGetReportRefById.mockReset();

    mockAck = vi.fn();
    mockNack = vi.fn();
    messageHandler = undefined;

    // Create a mock that captures the message handler
    mockSubscriptionOn = vi.fn((event: string, handler: unknown) => {
      if (event === "message") {
        messageHandler = handler as typeof messageHandler;
      }
    });

    // Override the PubSub mock to use our handler-capturing mock
    const { PubSub } = await import("@google-cloud/pubsub");
    vi.mocked(PubSub).mockImplementation(
      () =>
        ({
          topic: vi.fn().mockImplementation(() => ({
            publishMessage: vi.fn().mockResolvedValue(undefined),
            get: vi.fn().mockResolvedValue([{ name: "test-topic" }]),
            name: "test-topic",
            subscription: vi.fn().mockImplementation(() => ({
              on: mockSubscriptionOn,
              close: vi.fn().mockResolvedValue(undefined),
              get: vi.fn().mockResolvedValue([{ name: "test-subscription" }]),
              name: "test-subscription",
            })),
          })),
        }) as unknown as InstanceType<typeof PubSub>,
    );
  });

  async function createQueueAndListen(): Promise<GooglePubSubQueue> {
    const queue = new GooglePubSubQueue(
      "test-topic",
      "test-subscription",
      "test-project",
    );
    await queue.listen();
    return queue;
  }

  function createMockMessage(jobData: PipelineJob): {
    id: string;
    data: Buffer;
    ack: ReturnType<typeof vi.fn>;
    nack: ReturnType<typeof vi.fn>;
  } {
    return {
      id: "test-message-id",
      data: Buffer.from(JSON.stringify(jobData)),
      ack: mockAck,
      nack: mockNack,
    };
  }

  it("should ACK message only after successful processing", async () => {
    mockProcessJob.mockResolvedValue(undefined);

    await createQueueAndListen();

    expect(messageHandler).toBeDefined();

    const jobData = createMockPipelineJob();
    const mockMessage = createMockMessage(jobData);

    await messageHandler?.(mockMessage);

    expect(mockProcessJob).toHaveBeenCalledWith(jobData);
    expect(mockAck).toHaveBeenCalledTimes(1);
    expect(mockNack).not.toHaveBeenCalled();
    expect(mockProcessJobFailure).not.toHaveBeenCalled();
  });

  it("should NACK message on processing failure", async () => {
    const processingError = new Error("Processing failed");
    mockProcessJob.mockRejectedValue(processingError);

    await createQueueAndListen();

    expect(messageHandler).toBeDefined();

    const jobData = createMockPipelineJob();
    const mockMessage = createMockMessage(jobData);

    await messageHandler?.(mockMessage);

    expect(mockProcessJob).toHaveBeenCalledWith(jobData);
    expect(mockNack).toHaveBeenCalledTimes(1);
    expect(mockAck).not.toHaveBeenCalled();
    expect(mockProcessJobFailure).toHaveBeenCalledWith(
      jobData,
      processingError,
    );
  });

  it("should NACK and log error on JSON parse failure", async () => {
    await createQueueAndListen();

    expect(messageHandler).toBeDefined();

    const mockMessage = {
      id: "test-message-id",
      data: Buffer.from("invalid json {{{"),
      ack: mockAck,
      nack: mockNack,
    };

    await messageHandler?.(mockMessage);

    expect(mockProcessJob).not.toHaveBeenCalled();
    expect(mockNack).toHaveBeenCalledTimes(1);
    expect(mockAck).not.toHaveBeenCalled();
    // processJobFailure should not be called when we can't parse the job
    expect(mockProcessJobFailure).not.toHaveBeenCalled();
  });

  it("should convert non-Error objects to Error in processJobFailure", async () => {
    const nonErrorObject = "string error message";
    mockProcessJob.mockRejectedValue(nonErrorObject);

    await createQueueAndListen();

    expect(messageHandler).toBeDefined();

    const jobData = createMockPipelineJob();
    const mockMessage = createMockMessage(jobData);

    await messageHandler?.(mockMessage);

    expect(mockNack).toHaveBeenCalledTimes(1);
    expect(mockProcessJobFailure).toHaveBeenCalledWith(
      jobData,
      expect.any(Error),
    );

    const passedError = mockProcessJobFailure.mock.calls[0][1];
    expect(passedError.message).toBe("string error message");
  });

  describe("idempotency checks", () => {
    it("should ACK and skip processing when job is already completed", async () => {
      mockGetReportRefById.mockResolvedValue({
        status: "completed",
        id: "test-job",
      });

      await createQueueAndListen();

      expect(messageHandler).toBeDefined();

      const jobData = createMockPipelineJob();
      const mockMessage = createMockMessage(jobData);

      await messageHandler?.(mockMessage);

      expect(mockGetReportRefById).toHaveBeenCalledWith("test-job");
      expect(mockProcessJob).not.toHaveBeenCalled();
      expect(mockAck).toHaveBeenCalledTimes(1);
      expect(mockNack).not.toHaveBeenCalled();
    });

    it("should skip without ACK when job is still processing", async () => {
      mockGetReportRefById.mockResolvedValue({
        status: "processing",
        id: "test-job",
      });

      await createQueueAndListen();

      expect(messageHandler).toBeDefined();

      const jobData = createMockPipelineJob();
      const mockMessage = createMockMessage(jobData);

      await messageHandler?.(mockMessage);

      expect(mockGetReportRefById).toHaveBeenCalledWith("test-job");
      expect(mockProcessJob).not.toHaveBeenCalled();
      expect(mockAck).not.toHaveBeenCalled();
      expect(mockNack).not.toHaveBeenCalled();
    });

    it("should process normally when job status is queued", async () => {
      mockGetReportRefById.mockResolvedValue({
        status: "queued",
        id: "test-job",
      });
      mockProcessJob.mockResolvedValue(undefined);

      await createQueueAndListen();

      expect(messageHandler).toBeDefined();

      const jobData = createMockPipelineJob();
      const mockMessage = createMockMessage(jobData);

      await messageHandler?.(mockMessage);

      expect(mockGetReportRefById).toHaveBeenCalledWith("test-job");
      expect(mockProcessJob).toHaveBeenCalledWith(jobData);
      expect(mockAck).toHaveBeenCalledTimes(1);
      expect(mockNack).not.toHaveBeenCalled();
    });

    it("should process normally when job status is failed", async () => {
      mockGetReportRefById.mockResolvedValue({
        status: "failed",
        id: "test-job",
      });
      mockProcessJob.mockResolvedValue(undefined);

      await createQueueAndListen();

      expect(messageHandler).toBeDefined();

      const jobData = createMockPipelineJob();
      const mockMessage = createMockMessage(jobData);

      await messageHandler?.(mockMessage);

      expect(mockGetReportRefById).toHaveBeenCalledWith("test-job");
      expect(mockProcessJob).toHaveBeenCalledWith(jobData);
      expect(mockAck).toHaveBeenCalledTimes(1);
      expect(mockNack).not.toHaveBeenCalled();
    });

    it("should process normally when reportRef is not found", async () => {
      mockGetReportRefById.mockResolvedValue(null);
      mockProcessJob.mockResolvedValue(undefined);

      await createQueueAndListen();

      expect(messageHandler).toBeDefined();

      const jobData = createMockPipelineJob();
      const mockMessage = createMockMessage(jobData);

      await messageHandler?.(mockMessage);

      expect(mockGetReportRefById).toHaveBeenCalledWith("test-job");
      expect(mockProcessJob).toHaveBeenCalledWith(jobData);
      expect(mockAck).toHaveBeenCalledTimes(1);
      expect(mockNack).not.toHaveBeenCalled();
    });

    it("should use reportId over firebaseJobId when available", async () => {
      mockGetReportRefById.mockResolvedValue({
        status: "completed",
        id: "test-report-id",
      });

      await createQueueAndListen();

      expect(messageHandler).toBeDefined();

      const jobData = createMockPipelineJob();
      jobData.config.firebaseDetails.reportId = "test-report-id";
      const mockMessage = createMockMessage(jobData);

      await messageHandler?.(mockMessage);

      expect(mockGetReportRefById).toHaveBeenCalledWith("test-report-id");
      expect(mockAck).toHaveBeenCalledTimes(1);
    });
  });
});
