import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BucketStore } from "../../bucketstore/index.js";
import type { RefStoreServices } from "../../datastore/refstore/index.js";
import type { RedisPipelineStateStore } from "../../pipeline-runner/state-store.js";
import type {
  PipelineState,
  PipelineStepName,
} from "../../pipeline-runner/types.js";
import type { SortAndDeduplicateResult } from "../../pipeline-steps/types.js";
import { handlePipelineJob, validateDataArray } from "../handler";
import type { PubSubMessage } from "../index.js";

// Mock logger
vi.mock("tttc-common/logger", () => {
  const createMockLogger = (): Record<string, unknown> => {
    const mockLogger: Record<string, unknown> = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    mockLogger.child = () => createMockLogger();
    return mockLogger;
  };
  return { logger: createMockLogger() };
});

// Mock runPipeline
vi.mock("../../pipeline-runner/index.js", () => ({
  runPipeline: vi.fn(),
}));

// Test helpers
const createComment = (
  id: string,
  text: string,
): { comment_id: string; comment_text: string; speaker: string } => ({
  comment_id: id,
  comment_text: text,
  speaker: "participant",
});

const expectValidationFailure = (
  result: ReturnType<typeof validateDataArray>,
  expectedMessage: string,
) => {
  expect(result.tag).toBe("failure");
  if (result.tag === "failure") {
    expect(result.error.message).toBe(expectedMessage);
  }
};

describe("validateDataArray", () => {
  it("should return success for valid non-empty comments", () => {
    const data = [
      createComment("1", "This is a valid comment"),
      createComment("2", "Another valid comment"),
    ];

    const result = validateDataArray(data);
    expect(result.tag).toBe("success");
  });

  it("should return failure for empty data array", () => {
    const result = validateDataArray([]);
    expectValidationFailure(
      result,
      "Data array is empty - no comments to process",
    );
  });

  it.each([
    {
      description: "empty comment text",
      comments: [
        createComment("1", "Valid comment"),
        createComment("2", ""),
        createComment("3", "Another valid comment"),
      ],
      expectedMessage:
        "Found 1 comment(s) with empty or whitespace-only text: 2",
    },
    {
      description: "whitespace-only comment text",
      comments: [
        createComment("1", "Valid comment"),
        createComment("2", "   "),
        createComment("3", "\t\n"),
      ],
      expectedMessage:
        "Found 2 comment(s) with empty or whitespace-only text: 2, 3",
    },
    {
      description: "multiple empty comments with 'and more' suffix",
      comments: [
        createComment("id1", ""),
        createComment("id2", "   "),
        createComment("id3", ""),
        createComment("id4", "  \t  "),
        createComment("id5", ""),
        createComment("id6", ""),
        createComment("id7", ""),
      ],
      expectedMessage:
        "Found 7 comment(s) with empty or whitespace-only text: id1, id2, id3, id4, id5 and 2 more",
    },
    {
      description: "exactly 5 empty comments without 'and more' suffix",
      comments: [
        createComment("id1", ""),
        createComment("id2", ""),
        createComment("id3", ""),
        createComment("id4", ""),
        createComment("id5", ""),
      ],
      expectedMessage:
        "Found 5 comment(s) with empty or whitespace-only text: id1, id2, id3, id4, id5",
    },
  ])("should return failure for $description", ({
    comments,
    expectedMessage,
  }) => {
    const result = validateDataArray(comments);
    expectValidationFailure(result, expectedMessage);
  });

  it("should return success for comments with leading/trailing whitespace but content", () => {
    const data = [
      createComment("1", "  Valid comment with spaces  "),
      createComment("2", "\tTabbed comment\t"),
    ];

    const result = validateDataArray(data);
    expect(result.tag).toBe("success");
  });

  it("should return success for single valid comment", () => {
    const data = [createComment("1", "Single valid comment")];

    const result = validateDataArray(data);
    expect(result.tag).toBe("success");
  });
});

// Shared test helper for rollback behavior tests
type MockStorage = {
  storeFile: ReturnType<typeof vi.fn>;
  deleteFile: ReturnType<typeof vi.fn>;
  fileExists: ReturnType<typeof vi.fn>;
};

type MockRefStore = {
  Report: {
    get: ReturnType<typeof vi.fn>;
    modify: ReturnType<typeof vi.fn>;
  };
};

type MockPipelineResult = {
  sortedTree: Array<
    [string, { topics: Array<never>; counts: { claims: number } }]
  >;
  completedAt: string;
};

type MockData = {
  reportDetails: {
    title: string;
    description: string;
  };
  data: Array<{ comment_id: string; comment_text: string; speaker: string }>;
};

type SavePipelineOptions = {
  result: MockPipelineResult;
  reportId: string;
  storage: MockStorage;
  refStore: MockRefStore;
};

const saveSuccessfulPipeline = async ({
  result,
  reportId,
  storage,
  refStore,
}: SavePipelineOptions) => {
  const reportUrl = await storage.storeFile(
    `${reportId}.json`,
    JSON.stringify(result),
  );

  try {
    const reportRef = await refStore.Report.get(reportId);
    await refStore.Report.modify(reportId, {
      ...reportRef,
      reportDataUri: reportUrl,
      status: "completed",
    });
  } catch (firestoreError) {
    try {
      await storage.deleteFile(`${reportId}.json`);
    } catch (_deleteError) {
      // Log but don't throw - deletion failure shouldn't mask original error
    }
    throw firestoreError;
  }
};

describe("saveSuccessfulPipeline rollback behavior", () => {
  const createMockPipelineResult = (): MockPipelineResult => ({
    sortedTree: [["topic1", { topics: [], counts: { claims: 5 } }]],
    completedAt: new Date().toISOString(),
  });

  const createMockData = (): MockData => ({
    reportDetails: {
      title: "Test Report",
      description: "Test Description",
    },
    data: [{ comment_id: "1", comment_text: "test", speaker: "user1" }],
  });

  it("should rollback GCS upload when Firestore update fails", async () => {
    const mockStorage: MockStorage = {
      storeFile: vi
        .fn()
        .mockResolvedValue("https://storage.googleapis.com/bucket/report.json"),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      fileExists: vi.fn(),
    };

    const mockRefStore: MockRefStore = {
      Report: {
        get: vi.fn().mockResolvedValue({
          reportId: "test-report-id",
          status: "processing",
          userId: "test-user",
        }),
        modify: vi
          .fn()
          .mockRejectedValue(new Error("Firestore connection failed")),
      },
    };

    await expect(
      saveSuccessfulPipeline({
        result: createMockPipelineResult(),
        reportId: "test-report-id",
        storage: mockStorage,
        refStore: mockRefStore,
      }),
    ).rejects.toThrow("Firestore connection failed");

    expect(mockStorage.storeFile).toHaveBeenCalledWith(
      "test-report-id.json",
      expect.any(String),
    );
    expect(mockRefStore.Report.modify).toHaveBeenCalled();
    expect(mockStorage.deleteFile).toHaveBeenCalledWith("test-report-id.json");
  });

  it("should log error if rollback deletion fails but still throw original error", async () => {
    const mockStorage: MockStorage = {
      storeFile: vi
        .fn()
        .mockResolvedValue("https://storage.googleapis.com/bucket/report.json"),
      deleteFile: vi
        .fn()
        .mockRejectedValue(new Error("Delete permission denied")),
      fileExists: vi.fn(),
    };

    const mockRefStore: MockRefStore = {
      Report: {
        get: vi.fn().mockResolvedValue({
          reportId: "test-report-id",
          status: "processing",
          userId: "test-user",
        }),
        modify: vi.fn().mockRejectedValue(new Error("Firestore update failed")),
      },
    };

    await expect(
      saveSuccessfulPipeline({
        result: createMockPipelineResult(),
        reportId: "test-report-id",
        storage: mockStorage,
        refStore: mockRefStore,
      }),
    ).rejects.toThrow("Firestore update failed");

    expect(mockStorage.deleteFile).toHaveBeenCalledWith("test-report-id.json");
  });
});

describe("handlePipelineJob - GCS rollback integration", () => {
  let mockStateStore: RedisPipelineStateStore;
  let mockStorage: BucketStore;
  let mockRefStore: RefStoreServices;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStateStore = {
      get: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      acquirePipelineLock: vi.fn(),
      extendPipelineLock: vi.fn(),
      releasePipelineLock: vi.fn(),
      incrementValidationFailure: vi.fn(),
    } as unknown as RedisPipelineStateStore;

    mockStorage = {
      storeFile: vi.fn(),
      deleteFile: vi.fn(),
      fileExists: vi.fn(),
    } as unknown as BucketStore;

    mockRefStore = {
      Report: {
        get: vi.fn(),
        modify: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
    } as unknown as RefStoreServices;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createMockMessage = (): PubSubMessage<{
    data: Array<{ comment_id: string; comment_text: string; speaker: string }>;
    config: {
      instructions: {
        systemInstructions: string;
        clusteringInstructions: string;
        extractionInstructions: string;
        dedupInstructions: string;
        summariesInstructions: string;
        cruxInstructions: string;
        outputLanguage?: string;
      };
      llm: { model: string; temperature: number; max_tokens: number };
      options: { cruxes: boolean; sortStrategy: "numPeople" | "numClaims" };
      env: { OPENAI_API_KEY: string };
      firebaseDetails: { reportId: string; userId: string };
    };
    reportDetails: {
      title: string;
      description: string;
      question: string;
      filename: string;
    };
  }> => ({
    id: "msg-123",
    data: {
      data: [
        { comment_id: "c1", comment_text: "Test comment", speaker: "Speaker1" },
      ],
      config: {
        instructions: {
          systemInstructions: "System instructions",
          clusteringInstructions: "Clustering instructions",
          extractionInstructions: "Extraction instructions",
          dedupInstructions: "Dedup instructions",
          summariesInstructions: "Summaries instructions",
          cruxInstructions: "Crux instructions",
        },
        llm: { model: "gpt-4", temperature: 0.7, max_tokens: 1000 },
        options: { cruxes: false, sortStrategy: "numPeople" },
        env: { OPENAI_API_KEY: "test-api-key" },
        firebaseDetails: {
          reportId: "test-report-123",
          userId: "test-user-123",
        },
      },
      reportDetails: {
        title: "Test Report",
        description: "Test Description",
        question: "Test Question",
        filename: "test.csv",
      },
    },
    attributes: { requestId: "req-123" },
    publishTime: new Date(),
  });

  const createCompletedState = (): Awaited<
    ReturnType<RedisPipelineStateStore["get"]>
  > => ({
    version: "1.0",
    reportId: "test-report-123",
    userId: "test-user-123",
    createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    updatedAt: new Date("2026-01-01T01:00:00Z").toISOString(),
    status: "completed",
    stepAnalytics: {
      clustering: {
        stepName: "clustering",
        status: "completed",
        startedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
        completedAt: new Date("2026-01-01T00:15:00Z").toISOString(),
        durationMs: 900000,
        totalTokens: 150,
        cost: 0.001,
      },
      claims: {
        stepName: "claims",
        status: "completed",
        startedAt: new Date("2026-01-01T00:15:00Z").toISOString(),
        completedAt: new Date("2026-01-01T00:30:00Z").toISOString(),
        durationMs: 900000,
        totalTokens: 300,
        cost: 0.002,
      },
      sort_and_deduplicate: {
        stepName: "sort_and_deduplicate",
        status: "completed",
        startedAt: new Date("2026-01-01T00:30:00Z").toISOString(),
        completedAt: new Date("2026-01-01T00:45:00Z").toISOString(),
        durationMs: 900000,
        totalTokens: 200,
        cost: 0.0015,
      },
      summaries: {
        stepName: "summaries",
        status: "completed",
        startedAt: new Date("2026-01-01T00:45:00Z").toISOString(),
        completedAt: new Date("2026-01-01T01:00:00Z").toISOString(),
        durationMs: 900000,
        totalTokens: 250,
        cost: 0.0018,
      },
      cruxes: {
        stepName: "cruxes",
        status: "skipped",
      },
    },
    completedResults: {
      clustering: {
        data: [
          {
            topicName: "Test Topic",
            topicShortDescription: "A test topic",
            subtopics: [
              {
                subtopicName: "Test Subtopic",
                subtopicShortDescription: "A test subtopic",
              },
            ],
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
        cost: 0.001,
      },
      claims: {
        data: {
          "Test Topic": {
            total: 1,
            subtopics: {
              "Test Subtopic": {
                total: 1,
                claims: [
                  {
                    claim: "Test claim",
                    quote: "Test quote",
                    speaker: "Speaker1",
                    topicName: "Test Topic",
                    subtopicName: "Test Subtopic",
                    commentId: "c1",
                  },
                ],
              },
            },
          },
        },
        usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
        cost: 0.002,
      },
      sort_and_deduplicate: {
        data: [
          [
            "Test Topic",
            {
              topics: [
                [
                  "Test Subtopic",
                  {
                    claims: [
                      {
                        claim: "Test claim",
                        quote: "Test quote",
                        speaker: "Speaker1",
                        topicName: "Test Topic",
                        subtopicName: "Test Subtopic",
                        commentId: "c1",
                        duplicates: [],
                        duplicated: false,
                      },
                    ],
                    speakers: ["Speaker1"],
                    counts: { claims: 1, speakers: 1 },
                  },
                ],
              ],
              speakers: ["Speaker1"],
              counts: { claims: 1, speakers: 1 },
            },
          ],
        ],
        usage: { input_tokens: 150, output_tokens: 100, total_tokens: 250 },
        cost: 0.0018,
      },
      summaries: {
        data: [
          {
            topicName: "Test Topic",
            summary: "Test summary",
          },
        ],
        usage: { input_tokens: 150, output_tokens: 100, total_tokens: 250 },
        cost: 0.0018,
      },
    },
    validationFailures: {
      clustering: 0,
      claims: 0,
      sort_and_deduplicate: 0,
      summaries: 0,
      cruxes: 0,
    },
    totalTokens: 900,
    totalCost: 0.0063,
    totalDurationMs: 3600000,
  });

  it("should rollback GCS upload when Firestore update fails in actual handler", async () => {
    const completedState = createCompletedState();
    const message = createMockMessage();

    // Mock that storage doesn't exist but state shows completed
    vi.mocked(mockStorage.fileExists).mockResolvedValue({ exists: false });
    vi.mocked(mockStateStore.get).mockResolvedValue(completedState);
    vi.mocked(mockStateStore.acquirePipelineLock).mockResolvedValue(true);
    vi.mocked(mockStateStore.releasePipelineLock).mockResolvedValue(true);

    // Mock successful GCS upload
    vi.mocked(mockStorage.storeFile).mockResolvedValue(
      "gs://bucket/test-report-123.json",
    );

    // Mock successful ReportRef.get but failed modify (Firestore connection failure)
    vi.mocked(mockRefStore.Report.get).mockResolvedValue({
      id: "test-report-123",
      userId: "test-user-123",
      reportDataUri: "",
      title: "Test Report",
      description: "Test Description",
      numTopics: 0,
      numSubtopics: 0,
      numClaims: 0,
      numPeople: 0,
      status: "processing",
      createdDate: new Date(),
      lastStatusUpdate: new Date(),
    });

    vi.mocked(mockRefStore.Report.modify).mockRejectedValue(
      new Error("Firestore connection failed"),
    );

    // Mock successful deletion (rollback)
    vi.mocked(mockStorage.deleteFile).mockResolvedValue(undefined);

    const result = await handlePipelineJob(
      message,
      mockStateStore,
      mockStorage,
      mockRefStore,
    );

    // Verify the result is a failure
    expect(result.tag).toBe("failure");
    if (result.tag === "failure") {
      expect(result.error.message).toContain("Firestore connection failed");
    }

    // Verify the sequence of operations
    expect(mockStorage.fileExists).toHaveBeenCalledWith("test-report-123.json");
    expect(mockStateStore.acquirePipelineLock).toHaveBeenCalled();
    expect(mockStorage.storeFile).toHaveBeenCalledWith(
      "test-report-123.json",
      expect.any(String),
    );
    expect(mockRefStore.Report.modify).toHaveBeenCalled();

    // Critical assertion: Verify rollback was triggered
    expect(mockStorage.deleteFile).toHaveBeenCalledWith("test-report-123.json");

    // Verify lock was released
    expect(mockStateStore.releasePipelineLock).toHaveBeenCalled();
  });

  it("should handle rollback deletion failure but preserve original error", async () => {
    const completedState = createCompletedState();
    const message = createMockMessage();

    vi.mocked(mockStorage.fileExists).mockResolvedValue({ exists: false });
    vi.mocked(mockStateStore.get).mockResolvedValue(completedState);
    vi.mocked(mockStateStore.acquirePipelineLock).mockResolvedValue(true);
    vi.mocked(mockStateStore.releasePipelineLock).mockResolvedValue(true);

    vi.mocked(mockStorage.storeFile).mockResolvedValue(
      "gs://bucket/test-report-123.json",
    );

    vi.mocked(mockRefStore.Report.get).mockResolvedValue({
      id: "test-report-123",
      userId: "test-user-123",
      reportDataUri: "",
      title: "Test Report",
      description: "Test Description",
      numTopics: 0,
      numSubtopics: 0,
      numClaims: 0,
      numPeople: 0,
      status: "processing",
      createdDate: new Date(),
      lastStatusUpdate: new Date(),
    });

    // Firestore update fails
    vi.mocked(mockRefStore.Report.modify).mockRejectedValue(
      new Error("Firestore update failed"),
    );

    // Rollback deletion also fails
    vi.mocked(mockStorage.deleteFile).mockRejectedValue(
      new Error("Delete permission denied"),
    );

    const result = await handlePipelineJob(
      message,
      mockStateStore,
      mockStorage,
      mockRefStore,
    );

    // Should still fail with the original Firestore error, not the deletion error
    expect(result.tag).toBe("failure");
    if (result.tag === "failure") {
      expect(result.error.message).toContain("Firestore update failed");
      expect(result.error.message).not.toContain("Delete permission denied");
    }

    // Verify rollback was attempted
    expect(mockStorage.deleteFile).toHaveBeenCalledWith("test-report-123.json");
  });
});

describe("handlePipelineJob - save-only retry", () => {
  const mockSortedResult: SortAndDeduplicateResult = {
    data: [
      [
        "Test Topic",
        {
          topics: [
            [
              "Test Subtopic",
              {
                claims: [
                  {
                    claim: "Test claim",
                    quote: "Test quote",
                    speaker: "Speaker1",
                    topicName: "Test Topic",
                    subtopicName: "Test Subtopic",
                    commentId: "c1",
                    duplicates: [],
                    duplicated: false,
                  },
                ],
                speakers: ["Speaker1"],
                counts: { claims: 1, speakers: 1 },
              },
            ],
          ],
          speakers: ["Speaker1"],
          counts: { claims: 1, speakers: 1 },
        },
      ],
    ],
    usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
    cost: 0.001,
  };

  // Helper to create step analytics with completed status
  const createStepAnalytics = (options: {
    stepName: PipelineStepName;
    startTime: string;
    endTime: string;
    tokens: number;
    cost: number;
  }) => ({
    stepName: options.stepName,
    status: "completed" as const,
    startedAt: options.startTime,
    completedAt: options.endTime,
    durationMs: 900000,
    totalTokens: options.tokens,
    cost: options.cost,
  });

  // Helper to create completed results for all pipeline steps
  const createCompletedResults = () => ({
    clustering: {
      data: [
        {
          topicName: "Test Topic",
          topicShortDescription: "A test topic",
          subtopics: [
            {
              subtopicName: "Test Subtopic",
              subtopicShortDescription: "A test subtopic",
            },
          ],
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      cost: 0.001,
    },
    claims: {
      data: {
        "Test Topic": {
          total: 1,
          subtopics: {
            "Test Subtopic": {
              total: 1,
              claims: [
                {
                  claim: "Test claim",
                  quote: "Test quote",
                  speaker: "Speaker1",
                  topicName: "Test Topic",
                  subtopicName: "Test Subtopic",
                  commentId: "c1",
                },
              ],
            },
          },
        },
      },
      usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
      cost: 0.002,
    },
    sort_and_deduplicate: mockSortedResult,
    summaries: {
      data: [
        {
          topicName: "Test Topic",
          summary: "Test summary",
        },
      ],
      usage: { input_tokens: 150, output_tokens: 100, total_tokens: 250 },
      cost: 0.0018,
    },
  });

  // Helper to create validation failures object
  const createValidationFailures = () => ({
    clustering: 0,
    claims: 0,
    sort_and_deduplicate: 0,
    summaries: 0,
    cruxes: 0,
  });

  const createCompletedState = (): PipelineState => ({
    version: "1.0",
    reportId: "test-report-123",
    userId: "test-user-123",
    createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    updatedAt: new Date("2026-01-01T01:00:00Z").toISOString(),
    status: "completed",
    stepAnalytics: {
      clustering: createStepAnalytics({
        stepName: "clustering",
        startTime: new Date("2026-01-01T00:00:00Z").toISOString(),
        endTime: new Date("2026-01-01T00:15:00Z").toISOString(),
        tokens: 150,
        cost: 0.001,
      }),
      claims: createStepAnalytics({
        stepName: "claims",
        startTime: new Date("2026-01-01T00:15:00Z").toISOString(),
        endTime: new Date("2026-01-01T00:30:00Z").toISOString(),
        tokens: 300,
        cost: 0.002,
      }),
      sort_and_deduplicate: createStepAnalytics({
        stepName: "sort_and_deduplicate",
        startTime: new Date("2026-01-01T00:30:00Z").toISOString(),
        endTime: new Date("2026-01-01T00:45:00Z").toISOString(),
        tokens: 200,
        cost: 0.0015,
      }),
      summaries: createStepAnalytics({
        stepName: "summaries",
        startTime: new Date("2026-01-01T00:45:00Z").toISOString(),
        endTime: new Date("2026-01-01T01:00:00Z").toISOString(),
        tokens: 250,
        cost: 0.0018,
      }),
      cruxes: {
        stepName: "cruxes",
        status: "skipped",
      },
    },
    completedResults: createCompletedResults(),
    validationFailures: createValidationFailures(),
    totalTokens: 900,
    totalCost: 0.0063,
    totalDurationMs: 3600000,
  });

  const createMockMessage = (): PubSubMessage<{
    data: Array<{ comment_id: string; comment_text: string; speaker: string }>;
    config: {
      instructions: {
        systemInstructions: string;
        clusteringInstructions: string;
        extractionInstructions: string;
        dedupInstructions: string;
        summariesInstructions: string;
        cruxInstructions: string;
        outputLanguage?: string;
      };
      llm: { model: string; temperature: number; max_tokens: number };
      options: { cruxes: boolean; sortStrategy: "numPeople" | "numClaims" };
      env: { OPENAI_API_KEY: string };
      firebaseDetails: { reportId: string; userId: string };
    };
    reportDetails: {
      title: string;
      description: string;
      question: string;
      filename: string;
    };
  }> => ({
    id: "msg-123",
    data: {
      data: [
        { comment_id: "c1", comment_text: "Test comment", speaker: "Speaker1" },
      ],
      config: {
        instructions: {
          systemInstructions: "System instructions",
          clusteringInstructions: "Clustering instructions",
          extractionInstructions: "Extraction instructions",
          dedupInstructions: "Dedup instructions",
          summariesInstructions: "Summaries instructions",
          cruxInstructions: "Crux instructions",
        },
        llm: { model: "gpt-4", temperature: 0.7, max_tokens: 1000 },
        options: { cruxes: false, sortStrategy: "numPeople" },
        env: { OPENAI_API_KEY: "test-api-key" },
        firebaseDetails: {
          reportId: "test-report-123",
          userId: "test-user-123",
        },
      },
      reportDetails: {
        title: "Test Report",
        description: "Test Description",
        question: "Test Question",
        filename: "test.csv",
      },
    },
    attributes: { requestId: "req-123" },
    publishTime: new Date(),
  });

  let mockStateStore: RedisPipelineStateStore;
  let mockStorage: BucketStore;
  let mockRefStore: RefStoreServices;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStateStore = {
      get: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      acquirePipelineLock: vi.fn(),
      extendPipelineLock: vi.fn(),
      releasePipelineLock: vi.fn(),
      incrementValidationFailure: vi.fn(),
    } as unknown as RedisPipelineStateStore;

    mockStorage = {
      storeFile: vi.fn(),
      fileExists: vi.fn(),
      deleteFile: vi.fn(),
    } as unknown as BucketStore;

    mockRefStore = {
      Report: {
        get: vi.fn(),
        modify: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
    } as unknown as RefStoreServices;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should retry save operations when pipeline is completed but storage is missing", async () => {
    const completedState = createCompletedState();
    const message = createMockMessage();

    // Mock that storage doesn't exist but state shows completed
    vi.mocked(mockStorage.fileExists).mockResolvedValue({ exists: false });
    vi.mocked(mockStateStore.get).mockResolvedValue(completedState);
    vi.mocked(mockStateStore.acquirePipelineLock).mockResolvedValue(true);
    vi.mocked(mockStateStore.releasePipelineLock).mockResolvedValue(true);

    // Mock successful save operations
    vi.mocked(mockStorage.storeFile).mockResolvedValue(
      "gs://bucket/test-report-123.json",
    );
    vi.mocked(mockRefStore.Report.get).mockResolvedValue({
      id: "test-report-123",
      userId: "test-user-123",
      reportDataUri: "gs://bucket/test-report-123.json",
      title: "Test Report",
      description: "Test Description",
      numTopics: 5,
      numSubtopics: 10,
      numClaims: 20,
      numPeople: 15,
      status: "processing",
      createdDate: new Date(),
      lastStatusUpdate: new Date(),
    });
    vi.mocked(mockRefStore.Report.modify).mockResolvedValue(undefined);

    const result = await handlePipelineJob(
      message,
      mockStateStore,
      mockStorage,
      mockRefStore,
    );

    expect(result.tag).toBe("success");
    expect(mockStorage.fileExists).toHaveBeenCalledWith("test-report-123.json");
    expect(mockStateStore.get).toHaveBeenCalledWith("test-report-123");
    expect(mockStateStore.acquirePipelineLock).toHaveBeenCalled();

    // Verify that runPipeline was NOT called (save-only path)
    const { runPipeline } = await import("../../pipeline-runner/index.js");
    expect(runPipeline).not.toHaveBeenCalled();

    // Verify save operations were called
    expect(mockStorage.storeFile).toHaveBeenCalledWith(
      "test-report-123.json",
      expect.any(String),
    );
    expect(mockRefStore.Report.modify).toHaveBeenCalled();
    expect(mockStateStore.releasePipelineLock).toHaveBeenCalled();
  });

  it("should handle missing sort_and_deduplicate result gracefully", async () => {
    const incompletedState = createCompletedState();
    // Remove the critical result needed for reconstruction
    delete incompletedState.completedResults.sort_and_deduplicate;

    const message = createMockMessage();

    vi.mocked(mockStorage.fileExists).mockResolvedValue({ exists: false });
    vi.mocked(mockStateStore.get).mockResolvedValue(incompletedState);
    vi.mocked(mockStateStore.acquirePipelineLock).mockResolvedValue(true);
    vi.mocked(mockStateStore.releasePipelineLock).mockResolvedValue(true);

    const result = await handlePipelineJob(
      message,
      mockStateStore,
      mockStorage,
      mockRefStore,
    );

    expect(result.tag).toBe("failure");
    if (result.tag === "failure") {
      expect(result.error.message).toContain(
        "sort_and_deduplicate result missing",
      );
    }

    // Verify lock was still released
    expect(mockStateStore.releasePipelineLock).toHaveBeenCalled();
  });

  it("should reconstruct pipeline output correctly from completed state", async () => {
    const completedState = createCompletedState();
    const message = createMockMessage();

    vi.mocked(mockStorage.fileExists).mockResolvedValue({ exists: false });
    vi.mocked(mockStateStore.get).mockResolvedValue(completedState);
    vi.mocked(mockStateStore.acquirePipelineLock).mockResolvedValue(true);
    vi.mocked(mockStateStore.releasePipelineLock).mockResolvedValue(true);

    let savedJson: string | undefined;
    vi.mocked(mockStorage.storeFile).mockImplementation(
      async (filename, content) => {
        savedJson = content;
        return `gs://bucket/${filename}`;
      },
    );

    vi.mocked(mockRefStore.Report.get).mockResolvedValue({
      id: "test-report-123",
      userId: "test-user-123",
      reportDataUri: "gs://bucket/test-report-123.json",
      title: "Test Report",
      description: "Test Description",
      numTopics: 5,
      numSubtopics: 10,
      numClaims: 20,
      numPeople: 15,
      status: "processing",
      createdDate: new Date(),
      lastStatusUpdate: new Date(),
    });
    vi.mocked(mockRefStore.Report.modify).mockResolvedValue(undefined);

    const result = await handlePipelineJob(
      message,
      mockStateStore,
      mockStorage,
      mockRefStore,
    );

    expect(result.tag).toBe("success");
    expect(savedJson).toBeDefined();

    if (savedJson) {
      const savedOutput = JSON.parse(savedJson);
      expect(savedOutput.version).toBe("pipeline-worker-v1.0");
      expect(savedOutput.sortedTree).toEqual(mockSortedResult.data);
      expect(savedOutput.analytics.totalTokens).toBe(900);
      expect(savedOutput.analytics.totalCost).toBe(0.0063);
      expect(savedOutput.reportDetails.title).toBe("Test Report");
    }
  });
});

describe("handlePipelineJob - running state staleness check", () => {
  // Helper to create step analytics for running state tests
  const createRunningStepAnalytics = () => ({
    clustering: {
      stepName: "clustering" as const,
      status: "completed" as const,
      startedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
      completedAt: new Date("2026-01-01T00:15:00Z").toISOString(),
      durationMs: 900000,
      totalTokens: 150,
      cost: 0.001,
    },
    claims: {
      stepName: "claims" as const,
      status: "in_progress" as const,
      startedAt: new Date("2026-01-01T00:15:00Z").toISOString(),
      durationMs: 0,
      totalTokens: 0,
      cost: 0,
    },
    sort_and_deduplicate: {
      stepName: "sort_and_deduplicate" as const,
      status: "pending" as const,
      durationMs: 0,
      totalTokens: 0,
      cost: 0,
    },
    summaries: {
      stepName: "summaries" as const,
      status: "pending" as const,
      durationMs: 0,
      totalTokens: 0,
      cost: 0,
    },
    cruxes: {
      stepName: "cruxes" as const,
      status: "pending" as const,
      durationMs: 0,
      totalTokens: 0,
      cost: 0,
    },
  });

  // Helper to create completed clustering result
  const createClusteringResult = () => ({
    data: [
      {
        topicName: "Test Topic",
        topicShortDescription: "A test topic",
        subtopics: [
          {
            subtopicName: "Test Subtopic",
            subtopicShortDescription: "A test subtopic",
          },
        ],
      },
    ],
    usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
    cost: 0.001,
  });

  const createRunningState = (updatedAt: string): PipelineState => ({
    version: "1.0",
    reportId: "test-report-123",
    userId: "test-user-123",
    createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    updatedAt,
    status: "running",
    currentStep: "claims",
    stepAnalytics: createRunningStepAnalytics(),
    completedResults: {
      clustering: createClusteringResult(),
    },
    validationFailures: {
      clustering: 0,
      claims: 0,
      sort_and_deduplicate: 0,
      summaries: 0,
      cruxes: 0,
    },
    totalTokens: 150,
    totalCost: 0.001,
    totalDurationMs: 900000,
  });

  const createMockMessage = (): PubSubMessage<{
    data: Array<{ comment_id: string; comment_text: string; speaker: string }>;
    config: {
      instructions: {
        systemInstructions: string;
        clusteringInstructions: string;
        extractionInstructions: string;
        dedupInstructions: string;
        summariesInstructions: string;
        cruxInstructions: string;
        outputLanguage?: string;
      };
      llm: { model: string; temperature: number; max_tokens: number };
      options: { cruxes: boolean; sortStrategy: "numPeople" | "numClaims" };
      env: { OPENAI_API_KEY: string };
      firebaseDetails: { reportId: string; userId: string };
    };
    reportDetails: {
      title: string;
      description: string;
      question: string;
      filename: string;
    };
  }> => ({
    id: "msg-123",
    data: {
      data: [
        { comment_id: "c1", comment_text: "Test comment", speaker: "Speaker1" },
      ],
      config: {
        instructions: {
          systemInstructions: "System instructions",
          clusteringInstructions: "Clustering instructions",
          extractionInstructions: "Extraction instructions",
          dedupInstructions: "Dedup instructions",
          summariesInstructions: "Summaries instructions",
          cruxInstructions: "Crux instructions",
        },
        llm: { model: "gpt-4", temperature: 0.7, max_tokens: 1000 },
        options: { cruxes: false, sortStrategy: "numPeople" },
        env: { OPENAI_API_KEY: "test-api-key" },
        firebaseDetails: {
          reportId: "test-report-123",
          userId: "test-user-123",
        },
      },
      reportDetails: {
        title: "Test Report",
        description: "Test Description",
        question: "Test Question",
        filename: "test.csv",
      },
    },
    attributes: { requestId: "req-123" },
    publishTime: new Date(),
  });

  let mockStateStore: RedisPipelineStateStore;
  let mockStorage: BucketStore;
  let mockRefStore: RefStoreServices;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStateStore = {
      get: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      acquirePipelineLock: vi.fn(),
      extendPipelineLock: vi.fn(),
      releasePipelineLock: vi.fn(),
      incrementValidationFailure: vi.fn(),
    } as unknown as RedisPipelineStateStore;

    mockStorage = {
      storeFile: vi.fn(),
      fileExists: vi.fn(),
      deleteFile: vi.fn(),
    } as unknown as BucketStore;

    mockRefStore = {
      Report: {
        get: vi.fn(),
        modify: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
    } as unknown as RefStoreServices;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should skip resuming a fresh 'running' state (< lock TTL)", async () => {
    // State updated 5 minutes ago (well within 35 minute lock TTL)
    const recentTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const runningState = createRunningState(recentTime);
    const message = createMockMessage();

    vi.mocked(mockStorage.fileExists).mockResolvedValue({ exists: false });
    vi.mocked(mockStateStore.get).mockResolvedValue(runningState);
    vi.mocked(mockStateStore.acquirePipelineLock).mockResolvedValue(true);

    const result = await handlePipelineJob(
      message,
      mockStateStore,
      mockStorage,
      mockRefStore,
    );

    // Should succeed but not resume - just skip
    expect(result.tag).toBe("success");

    // Pipeline should NOT have been run (would have been called if resuming)
    const { runPipeline } = await import("../../pipeline-runner/index.js");
    expect(runPipeline).not.toHaveBeenCalled();
  });

  it("should resume a stale 'running' state (> lock TTL)", async () => {
    // State updated 40 minutes ago (exceeds 35 minute lock TTL)
    const staleTime = new Date(Date.now() - 40 * 60 * 1000).toISOString();
    const runningState = createRunningState(staleTime);
    const message = createMockMessage();

    vi.mocked(mockStorage.fileExists).mockResolvedValue({ exists: false });
    vi.mocked(mockStateStore.get).mockResolvedValue(runningState);
    vi.mocked(mockStateStore.acquirePipelineLock).mockResolvedValue(true);
    vi.mocked(mockStateStore.extendPipelineLock).mockResolvedValue(true);
    vi.mocked(mockStateStore.releasePipelineLock).mockResolvedValue(true);

    // Mock runPipeline to return success with proper PipelineResult shape
    const { runPipeline } = await import("../../pipeline-runner/index.js");
    const mockCompletedState = {
      ...runningState,
      status: "completed" as const,
      totalTokens: 0,
      totalCost: 0,
      totalDurationMs: 1000,
    };
    vi.mocked(runPipeline).mockResolvedValue({
      success: true,
      state: mockCompletedState,
      outputs: {
        topicTree: [],
        claimsTree: {},
        sortedTree: [],
        summaries: [],
      },
    });

    vi.mocked(mockStorage.storeFile).mockResolvedValue(
      "gs://bucket/test-report-123.json",
    );
    vi.mocked(mockRefStore.Report.get).mockResolvedValue({
      id: "test-report-123",
      userId: "test-user-123",
      reportDataUri: "gs://bucket/test-report-123.json",
      title: "Test Report",
      description: "Test Description",
      numTopics: 0,
      numSubtopics: 0,
      numClaims: 0,
      numPeople: 0,
      status: "processing",
      createdDate: new Date(),
      lastStatusUpdate: new Date(),
    });
    vi.mocked(mockRefStore.Report.modify).mockResolvedValue(undefined);

    const result = await handlePipelineJob(
      message,
      mockStateStore,
      mockStorage,
      mockRefStore,
    );

    // Should succeed and resume
    expect(result.tag).toBe("success");

    // Pipeline SHOULD have been run with resume flag
    expect(runPipeline).toHaveBeenCalledWith(
      expect.anything(), // pipelineInput
      expect.objectContaining({
        resumeFromState: true,
      }),
      expect.anything(), // stateStore
    );
  });

  it("should always resume 'failed' state regardless of staleness", async () => {
    // State updated just 1 minute ago but status is failed
    const recentTime = new Date(Date.now() - 1 * 60 * 1000).toISOString();
    const failedState: PipelineState = {
      ...createRunningState(recentTime),
      status: "failed",
      error: {
        message: "Test error",
        name: "Error",
        step: "claims",
      },
    };
    const message = createMockMessage();

    vi.mocked(mockStorage.fileExists).mockResolvedValue({ exists: false });
    vi.mocked(mockStateStore.get).mockResolvedValue(failedState);
    vi.mocked(mockStateStore.acquirePipelineLock).mockResolvedValue(true);
    vi.mocked(mockStateStore.extendPipelineLock).mockResolvedValue(true);
    vi.mocked(mockStateStore.releasePipelineLock).mockResolvedValue(true);

    // Mock runPipeline to return success with proper PipelineResult shape
    const { runPipeline } = await import("../../pipeline-runner/index.js");
    const mockCompletedState = {
      ...failedState,
      status: "completed" as const,
      totalTokens: 0,
      totalCost: 0,
      totalDurationMs: 1000,
      error: undefined,
    };
    vi.mocked(runPipeline).mockResolvedValue({
      success: true,
      state: mockCompletedState,
      outputs: {
        topicTree: [],
        claimsTree: {},
        sortedTree: [],
        summaries: [],
      },
    });

    vi.mocked(mockStorage.storeFile).mockResolvedValue(
      "gs://bucket/test-report-123.json",
    );
    vi.mocked(mockRefStore.Report.get).mockResolvedValue({
      id: "test-report-123",
      userId: "test-user-123",
      reportDataUri: "gs://bucket/test-report-123.json",
      title: "Test Report",
      description: "Test Description",
      numTopics: 0,
      numSubtopics: 0,
      numClaims: 0,
      numPeople: 0,
      status: "processing",
      createdDate: new Date(),
      lastStatusUpdate: new Date(),
    });
    vi.mocked(mockRefStore.Report.modify).mockResolvedValue(undefined);

    const result = await handlePipelineJob(
      message,
      mockStateStore,
      mockStorage,
      mockRefStore,
    );

    // Should succeed and resume even though recently updated
    expect(result.tag).toBe("success");

    // Pipeline SHOULD have been run with resume from state
    expect(runPipeline).toHaveBeenCalled();
  });
});
