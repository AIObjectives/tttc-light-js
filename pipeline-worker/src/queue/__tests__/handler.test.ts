import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BucketStore } from "../../bucketstore/index.js";
import type { RefStoreServices } from "../../datastore/refstore/index.js";
import type { RedisPipelineStateStore } from "../../pipeline-runner/state-store.js";
import type {
  PipelineState,
  PipelineStepName,
} from "../../pipeline-runner/types.js";
import type { SortAndDeduplicateResult } from "../../pipeline-steps/types.js";
import {
  categorizeError,
  handlePipelineJob,
  validateDataArray,
} from "../handler";
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

// Test constants
const TEST_IDS = {
  report: "test-report-123",
  user: "test-user-123",
  message: "msg-123",
  request: "req-123",
  comment: "c1",
} as const;

const TEST_DATES = {
  base: "2026-01-01T00:00:00Z",
  clustering: "2026-01-01T00:15:00Z",
  claims: "2026-01-01T00:30:00Z",
  sortDedup: "2026-01-01T00:45:00Z",
  summaries: "2026-01-01T01:00:00Z",
} as const;

const TEST_STRINGS = {
  title: "Test Report",
  description: "Test Description",
  question: "Test Question",
  filename: "test.csv",
  topic: "Test Topic",
  topicDesc: "A test topic",
  subtopic: "Test Subtopic",
  subtopicDesc: "A test subtopic",
  claim: "Test claim",
  quote: "Test quote",
  summary: "Test summary",
  speaker: "Speaker1",
  comment: "Test comment",
  apiKey: "test-api-key",
  model: "gpt-4",
} as const;

const TEST_INSTRUCTIONS = {
  system: "System instructions",
  clustering: "Clustering instructions",
  extraction: "Extraction instructions",
  dedup: "Dedup instructions",
  summaries: "Summaries instructions",
  crux: "Crux instructions",
} as const;

const TEST_ERRORS = {
  firestoreConnection: "Firestore connection failed",
  firestoreUpdate: "Firestore update failed",
  deletePermission: "Delete permission denied",
  testError: "Test error",
} as const;

const TEST_STORAGE = {
  bucket: "gs://bucket",
  filename: (id: string) => `${id}.json`,
  url: (id: string) => `gs://bucket/${id}.json`,
} as const;

// Test helpers
const createComment = (
  id: string,
  text: string,
  speaker = "participant",
): { comment_id: string; comment_text: string; speaker: string } => ({
  comment_id: id,
  comment_text: text,
  speaker,
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

// Factory function to create test mocks (eliminates duplication across describe blocks)
const createTestMocks = () => ({
  stateStore: {
    get: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    acquirePipelineLock: vi.fn(),
    extendPipelineLock: vi.fn(),
    releasePipelineLock: vi.fn(),
    incrementValidationFailure: vi.fn(),
  } as unknown as RedisPipelineStateStore,

  storage: {
    storeFile: vi.fn(),
    fileExists: vi.fn(),
    deleteFile: vi.fn(),
  } as unknown as BucketStore,

  refStore: {
    Report: {
      get: vi.fn(),
      modify: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as RefStoreServices,
});

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
    TEST_STORAGE.filename(reportId),
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
      await storage.deleteFile(TEST_STORAGE.filename(reportId));
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
      title: TEST_STRINGS.title,
      description: TEST_STRINGS.description,
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
          .mockRejectedValue(new Error(TEST_ERRORS.firestoreConnection)),
      },
    };

    await expect(
      saveSuccessfulPipeline({
        result: createMockPipelineResult(),
        reportId: "test-report-id",
        storage: mockStorage,
        refStore: mockRefStore,
      }),
    ).rejects.toThrow(TEST_ERRORS.firestoreConnection);

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
        .mockRejectedValue(new Error(TEST_ERRORS.deletePermission)),
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
          .mockRejectedValue(new Error(TEST_ERRORS.firestoreUpdate)),
      },
    };

    await expect(
      saveSuccessfulPipeline({
        result: createMockPipelineResult(),
        reportId: "test-report-id",
        storage: mockStorage,
        refStore: mockRefStore,
      }),
    ).rejects.toThrow(TEST_ERRORS.firestoreUpdate);

    expect(mockStorage.deleteFile).toHaveBeenCalledWith("test-report-id.json");
  });
});

describe("handlePipelineJob - GCS rollback integration", () => {
  let mockStateStore: RedisPipelineStateStore;
  let mockStorage: BucketStore;
  let mockRefStore: RefStoreServices;

  beforeEach(() => {
    vi.clearAllMocks();
    const mocks = createTestMocks();
    mockStateStore = mocks.stateStore;
    mockStorage = mocks.storage;
    mockRefStore = mocks.refStore;
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
    id: TEST_IDS.message,
    data: {
      data: [
        {
          comment_id: TEST_IDS.comment,
          comment_text: TEST_STRINGS.comment,
          speaker: TEST_STRINGS.speaker,
        },
      ],
      config: {
        instructions: {
          systemInstructions: TEST_INSTRUCTIONS.system,
          clusteringInstructions: TEST_INSTRUCTIONS.clustering,
          extractionInstructions: TEST_INSTRUCTIONS.extraction,
          dedupInstructions: TEST_INSTRUCTIONS.dedup,
          summariesInstructions: TEST_INSTRUCTIONS.summaries,
          cruxInstructions: TEST_INSTRUCTIONS.crux,
        },
        llm: { model: TEST_STRINGS.model, temperature: 0.7, max_tokens: 1000 },
        options: { cruxes: false, sortStrategy: "numPeople" },
        env: { OPENAI_API_KEY: TEST_STRINGS.apiKey },
        firebaseDetails: {
          reportId: TEST_IDS.report,
          userId: TEST_IDS.user,
        },
      },
      reportDetails: {
        title: TEST_STRINGS.title,
        description: TEST_STRINGS.description,
        question: TEST_STRINGS.question,
        filename: TEST_STRINGS.filename,
      },
    },
    attributes: { requestId: TEST_IDS.request },
    publishTime: new Date(),
  });

  // Base state builder - minimal fields
  const createBaseState = (
    overrides: Partial<
      Awaited<ReturnType<RedisPipelineStateStore["get"]>>
    > = {},
  ): Awaited<ReturnType<RedisPipelineStateStore["get"]>> => ({
    version: "1.0",
    reportId: TEST_IDS.report,
    userId: TEST_IDS.user,
    createdAt: new Date(TEST_DATES.base).toISOString(),
    updatedAt: new Date(TEST_DATES.summaries).toISOString(),
    status: "pending",
    stepAnalytics: {
      clustering: {
        stepName: "clustering",
        status: "pending",
        durationMs: 0,
        totalTokens: 0,
        cost: 0,
      },
      claims: {
        stepName: "claims",
        status: "pending",
        durationMs: 0,
        totalTokens: 0,
        cost: 0,
      },
      sort_and_deduplicate: {
        stepName: "sort_and_deduplicate",
        status: "pending",
        durationMs: 0,
        totalTokens: 0,
        cost: 0,
      },
      summaries: {
        stepName: "summaries",
        status: "pending",
        durationMs: 0,
        totalTokens: 0,
        cost: 0,
      },
      cruxes: {
        stepName: "cruxes",
        status: "pending",
        durationMs: 0,
        totalTokens: 0,
        cost: 0,
      },
    },
    completedResults: {},
    validationFailures: {
      clustering: 0,
      claims: 0,
      sort_and_deduplicate: 0,
      summaries: 0,
      cruxes: 0,
    },
    totalTokens: 0,
    totalCost: 0,
    totalDurationMs: 0,
    ...overrides,
  });

  // Step analytics builder
  const withCompletedSteps = (
    state: Awaited<ReturnType<RedisPipelineStateStore["get"]>>,
  ): Awaited<ReturnType<RedisPipelineStateStore["get"]>> => {
    if (!state) throw new Error("State is null");
    return {
      ...state,
      status: "completed",
      stepAnalytics: {
        clustering: {
          stepName: "clustering",
          status: "completed",
          startedAt: new Date(TEST_DATES.base).toISOString(),
          completedAt: new Date(TEST_DATES.clustering).toISOString(),
          durationMs: 900000,
          totalTokens: 150,
          cost: 0.001,
        },
        claims: {
          stepName: "claims",
          status: "completed",
          startedAt: new Date(TEST_DATES.clustering).toISOString(),
          completedAt: new Date(TEST_DATES.claims).toISOString(),
          durationMs: 900000,
          totalTokens: 300,
          cost: 0.002,
        },
        sort_and_deduplicate: {
          stepName: "sort_and_deduplicate",
          status: "completed",
          startedAt: new Date(TEST_DATES.claims).toISOString(),
          completedAt: new Date(TEST_DATES.sortDedup).toISOString(),
          durationMs: 900000,
          totalTokens: 200,
          cost: 0.0015,
        },
        summaries: {
          stepName: "summaries",
          status: "completed",
          startedAt: new Date(TEST_DATES.sortDedup).toISOString(),
          completedAt: new Date(TEST_DATES.summaries).toISOString(),
          durationMs: 900000,
          totalTokens: 250,
          cost: 0.0018,
        },
        cruxes: {
          stepName: "cruxes",
          status: "skipped",
        },
      },
      totalTokens: 900,
      totalCost: 0.0063,
      totalDurationMs: 3600000,
    };
  };

  // Mock data fixtures
  const MOCK_CLAIM = {
    claim: TEST_STRINGS.claim,
    quote: TEST_STRINGS.quote,
    speaker: TEST_STRINGS.speaker,
    topicName: TEST_STRINGS.topic,
    subtopicName: TEST_STRINGS.subtopic,
    commentId: TEST_IDS.comment,
  };

  const MOCK_SORT_DEDUPE_DATA: [
    string,
    {
      topics: [
        string,
        {
          claims: Array<
            typeof MOCK_CLAIM & { duplicates: never[]; duplicated: boolean }
          >;
          speakers: string[];
          counts: { claims: number; speakers: number };
        },
      ][];
      speakers: string[];
      counts: { claims: number; speakers: number };
    },
  ][] = [
    [
      TEST_STRINGS.topic,
      {
        topics: [
          [
            TEST_STRINGS.subtopic,
            {
              claims: [{ ...MOCK_CLAIM, duplicates: [], duplicated: false }],
              speakers: [TEST_STRINGS.speaker],
              counts: { claims: 1, speakers: 1 },
            },
          ],
        ],
        speakers: [TEST_STRINGS.speaker],
        counts: { claims: 1, speakers: 1 },
      },
    ],
  ];

  // Completed results builder
  const withCompletedResults = (
    state: Awaited<ReturnType<RedisPipelineStateStore["get"]>>,
  ): Awaited<ReturnType<RedisPipelineStateStore["get"]>> => {
    if (!state) throw new Error("State is null");
    return {
      ...state,
      completedResults: {
        clustering: {
          data: [
            {
              topicName: TEST_STRINGS.topic,
              topicShortDescription: TEST_STRINGS.topicDesc,
              subtopics: [
                {
                  subtopicName: TEST_STRINGS.subtopic,
                  subtopicShortDescription: TEST_STRINGS.subtopicDesc,
                },
              ],
            },
          ],
          usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
          cost: 0.001,
        },
        claims: {
          data: {
            [TEST_STRINGS.topic]: {
              total: 1,
              subtopics: {
                [TEST_STRINGS.subtopic]: { total: 1, claims: [MOCK_CLAIM] },
              },
            },
          },
          usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
          cost: 0.002,
        },
        sort_and_deduplicate: {
          data: MOCK_SORT_DEDUPE_DATA,
          usage: { input_tokens: 150, output_tokens: 100, total_tokens: 250 },
          cost: 0.0018,
        },
        summaries: {
          data: [
            { topicName: TEST_STRINGS.topic, summary: TEST_STRINGS.summary },
          ],
          usage: { input_tokens: 150, output_tokens: 100, total_tokens: 250 },
          cost: 0.0018,
        },
      },
    };
  };

  // Convenience function for fully completed state
  const createCompletedState = (): Awaited<
    ReturnType<RedisPipelineStateStore["get"]>
  > => withCompletedResults(withCompletedSteps(createBaseState()));

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
      TEST_STORAGE.url(TEST_IDS.report),
    );

    // Mock successful ReportRef.get but failed modify (Firestore connection failure)
    vi.mocked(mockRefStore.Report.get).mockResolvedValue({
      id: TEST_IDS.report,
      userId: TEST_IDS.user,
      reportDataUri: "",
      title: TEST_STRINGS.title,
      description: TEST_STRINGS.description,
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
      expect(result.error.message).toContain(TEST_ERRORS.firestoreConnection);
    }

    // Verify the sequence of operations
    expect(mockStorage.fileExists).toHaveBeenCalledWith(
      TEST_STORAGE.filename(TEST_IDS.report),
    );
    expect(mockStateStore.acquirePipelineLock).toHaveBeenCalled();
    expect(mockStorage.storeFile).toHaveBeenCalledWith(
      TEST_STORAGE.filename(TEST_IDS.report),
      expect.any(String),
    );
    expect(mockRefStore.Report.modify).toHaveBeenCalled();

    // Critical assertion: Verify rollback was triggered
    expect(mockStorage.deleteFile).toHaveBeenCalledWith(
      TEST_STORAGE.filename(TEST_IDS.report),
    );

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
      TEST_STORAGE.url(TEST_IDS.report),
    );

    vi.mocked(mockRefStore.Report.get).mockResolvedValue({
      id: TEST_IDS.report,
      userId: TEST_IDS.user,
      reportDataUri: "",
      title: TEST_STRINGS.title,
      description: TEST_STRINGS.description,
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
      expect(result.error.message).toContain(TEST_ERRORS.firestoreUpdate);
      expect(result.error.message).not.toContain(TEST_ERRORS.deletePermission);
    }

    // Verify rollback was attempted
    expect(mockStorage.deleteFile).toHaveBeenCalledWith(
      TEST_STORAGE.filename(TEST_IDS.report),
    );
  });
});

describe("handlePipelineJob - save-only retry", () => {
  const mockSortedResult: SortAndDeduplicateResult = {
    data: [
      [
        TEST_STRINGS.topic,
        {
          topics: [
            [
              TEST_STRINGS.subtopic,
              {
                claims: [
                  {
                    claim: TEST_STRINGS.claim,
                    quote: TEST_STRINGS.quote,
                    speaker: TEST_STRINGS.speaker,
                    topicName: TEST_STRINGS.topic,
                    subtopicName: TEST_STRINGS.subtopic,
                    commentId: TEST_IDS.comment,
                    duplicates: [],
                    duplicated: false,
                  },
                ],
                speakers: [TEST_STRINGS.speaker],
                counts: { claims: 1, speakers: 1 },
              },
            ],
          ],
          speakers: [TEST_STRINGS.speaker],
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
          topicName: TEST_STRINGS.topic,
          topicShortDescription: TEST_STRINGS.topicDesc,
          subtopics: [
            {
              subtopicName: TEST_STRINGS.subtopic,
              subtopicShortDescription: TEST_STRINGS.subtopicDesc,
            },
          ],
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      cost: 0.001,
    },
    claims: {
      data: {
        [TEST_STRINGS.topic]: {
          total: 1,
          subtopics: {
            [TEST_STRINGS.subtopic]: {
              total: 1,
              claims: [
                {
                  claim: TEST_STRINGS.claim,
                  quote: TEST_STRINGS.quote,
                  speaker: TEST_STRINGS.speaker,
                  topicName: TEST_STRINGS.topic,
                  subtopicName: TEST_STRINGS.subtopic,
                  commentId: TEST_IDS.comment,
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
          topicName: TEST_STRINGS.topic,
          summary: TEST_STRINGS.summary,
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
    reportId: TEST_IDS.report,
    userId: TEST_IDS.user,
    createdAt: new Date(TEST_DATES.base).toISOString(),
    updatedAt: new Date(TEST_DATES.summaries).toISOString(),
    status: "completed",
    stepAnalytics: {
      clustering: createStepAnalytics({
        stepName: "clustering",
        startTime: new Date(TEST_DATES.base).toISOString(),
        endTime: new Date(TEST_DATES.clustering).toISOString(),
        tokens: 150,
        cost: 0.001,
      }),
      claims: createStepAnalytics({
        stepName: "claims",
        startTime: new Date(TEST_DATES.clustering).toISOString(),
        endTime: new Date(TEST_DATES.claims).toISOString(),
        tokens: 300,
        cost: 0.002,
      }),
      sort_and_deduplicate: createStepAnalytics({
        stepName: "sort_and_deduplicate",
        startTime: new Date(TEST_DATES.claims).toISOString(),
        endTime: new Date(TEST_DATES.sortDedup).toISOString(),
        tokens: 200,
        cost: 0.0015,
      }),
      summaries: createStepAnalytics({
        stepName: "summaries",
        startTime: new Date(TEST_DATES.sortDedup).toISOString(),
        endTime: new Date(TEST_DATES.summaries).toISOString(),
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
    id: TEST_IDS.message,
    data: {
      data: [
        {
          comment_id: TEST_IDS.comment,
          comment_text: TEST_STRINGS.comment,
          speaker: TEST_STRINGS.speaker,
        },
      ],
      config: {
        instructions: {
          systemInstructions: TEST_INSTRUCTIONS.system,
          clusteringInstructions: TEST_INSTRUCTIONS.clustering,
          extractionInstructions: TEST_INSTRUCTIONS.extraction,
          dedupInstructions: TEST_INSTRUCTIONS.dedup,
          summariesInstructions: TEST_INSTRUCTIONS.summaries,
          cruxInstructions: TEST_INSTRUCTIONS.crux,
        },
        llm: { model: TEST_STRINGS.model, temperature: 0.7, max_tokens: 1000 },
        options: { cruxes: false, sortStrategy: "numPeople" },
        env: { OPENAI_API_KEY: TEST_STRINGS.apiKey },
        firebaseDetails: {
          reportId: TEST_IDS.report,
          userId: TEST_IDS.user,
        },
      },
      reportDetails: {
        title: TEST_STRINGS.title,
        description: TEST_STRINGS.description,
        question: TEST_STRINGS.question,
        filename: TEST_STRINGS.filename,
      },
    },
    attributes: { requestId: TEST_IDS.request },
    publishTime: new Date(),
  });

  let mockStateStore: RedisPipelineStateStore;
  let mockStorage: BucketStore;
  let mockRefStore: RefStoreServices;

  beforeEach(() => {
    vi.clearAllMocks();
    const mocks = createTestMocks();
    mockStateStore = mocks.stateStore;
    mockStorage = mocks.storage;
    mockRefStore = mocks.refStore;
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
      TEST_STORAGE.url(TEST_IDS.report),
    );
    vi.mocked(mockRefStore.Report.get).mockResolvedValue({
      id: TEST_IDS.report,
      userId: TEST_IDS.user,
      reportDataUri: TEST_STORAGE.url(TEST_IDS.report),
      title: TEST_STRINGS.title,
      description: TEST_STRINGS.description,
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
    expect(mockStorage.fileExists).toHaveBeenCalledWith(
      TEST_STORAGE.filename(TEST_IDS.report),
    );
    expect(mockStateStore.get).toHaveBeenCalledWith(TEST_IDS.report);
    expect(mockStateStore.acquirePipelineLock).toHaveBeenCalled();

    // Verify that runPipeline was NOT called (save-only path)
    const { runPipeline } = await import("../../pipeline-runner/index.js");
    expect(runPipeline).not.toHaveBeenCalled();

    // Verify save operations were called
    expect(mockStorage.storeFile).toHaveBeenCalledWith(
      TEST_STORAGE.filename(TEST_IDS.report),
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
      id: TEST_IDS.report,
      userId: TEST_IDS.user,
      reportDataUri: TEST_STORAGE.url(TEST_IDS.report),
      title: TEST_STRINGS.title,
      description: TEST_STRINGS.description,
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
      expect(savedOutput.reportDetails.title).toBe(TEST_STRINGS.title);
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
    reportId: TEST_IDS.report,
    userId: TEST_IDS.user,
    createdAt: new Date(TEST_DATES.base).toISOString(),
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
    id: TEST_IDS.message,
    data: {
      data: [
        {
          comment_id: TEST_IDS.comment,
          comment_text: TEST_STRINGS.comment,
          speaker: TEST_STRINGS.speaker,
        },
      ],
      config: {
        instructions: {
          systemInstructions: TEST_INSTRUCTIONS.system,
          clusteringInstructions: TEST_INSTRUCTIONS.clustering,
          extractionInstructions: TEST_INSTRUCTIONS.extraction,
          dedupInstructions: TEST_INSTRUCTIONS.dedup,
          summariesInstructions: TEST_INSTRUCTIONS.summaries,
          cruxInstructions: TEST_INSTRUCTIONS.crux,
        },
        llm: { model: TEST_STRINGS.model, temperature: 0.7, max_tokens: 1000 },
        options: { cruxes: false, sortStrategy: "numPeople" },
        env: { OPENAI_API_KEY: TEST_STRINGS.apiKey },
        firebaseDetails: {
          reportId: TEST_IDS.report,
          userId: TEST_IDS.user,
        },
      },
      reportDetails: {
        title: TEST_STRINGS.title,
        description: TEST_STRINGS.description,
        question: TEST_STRINGS.question,
        filename: TEST_STRINGS.filename,
      },
    },
    attributes: { requestId: TEST_IDS.request },
    publishTime: new Date(),
  });

  let mockStateStore: RedisPipelineStateStore;
  let mockStorage: BucketStore;
  let mockRefStore: RefStoreServices;

  beforeEach(() => {
    vi.clearAllMocks();
    const mocks = createTestMocks();
    mockStateStore = mocks.stateStore;
    mockStorage = mocks.storage;
    mockRefStore = mocks.refStore;
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
      TEST_STORAGE.url(TEST_IDS.report),
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
        message: TEST_ERRORS.testError,
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
      TEST_STORAGE.url(TEST_IDS.report),
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

describe("handlePipelineJob - orphaned file detection", () => {
  let mockStateStore: RedisPipelineStateStore;
  let mockStorage: BucketStore;
  let mockRefStore: RefStoreServices;

  beforeEach(() => {
    vi.clearAllMocks();
    const mocks = createTestMocks();
    mockStateStore = mocks.stateStore;
    mockStorage = mocks.storage;
    mockRefStore = mocks.refStore;
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
    id: TEST_IDS.message,
    data: {
      data: [
        {
          comment_id: TEST_IDS.comment,
          comment_text: TEST_STRINGS.comment,
          speaker: TEST_STRINGS.speaker,
        },
      ],
      config: {
        instructions: {
          systemInstructions: TEST_INSTRUCTIONS.system,
          clusteringInstructions: TEST_INSTRUCTIONS.clustering,
          extractionInstructions: TEST_INSTRUCTIONS.extraction,
          dedupInstructions: TEST_INSTRUCTIONS.dedup,
          summariesInstructions: TEST_INSTRUCTIONS.summaries,
          cruxInstructions: TEST_INSTRUCTIONS.crux,
        },
        llm: { model: TEST_STRINGS.model, temperature: 0.7, max_tokens: 1000 },
        options: { cruxes: false, sortStrategy: "numPeople" },
        env: { OPENAI_API_KEY: TEST_STRINGS.apiKey },
        firebaseDetails: {
          reportId: TEST_IDS.report,
          userId: TEST_IDS.user,
        },
      },
      reportDetails: {
        title: TEST_STRINGS.title,
        description: TEST_STRINGS.description,
        question: TEST_STRINGS.question,
        filename: TEST_STRINGS.filename,
      },
    },
    attributes: { requestId: TEST_IDS.request },
    publishTime: new Date(),
  });

  // Helper to create completed step analytics
  const createCompletedStepAnalytics = () => ({
    clustering: {
      stepName: "clustering" as const,
      status: "completed" as const,
      durationMs: 1000,
      totalTokens: 100,
      cost: 0.001,
    },
    claims: {
      stepName: "claims" as const,
      status: "completed" as const,
      durationMs: 1000,
      totalTokens: 100,
      cost: 0.001,
    },
    sort_and_deduplicate: {
      stepName: "sort_and_deduplicate" as const,
      status: "completed" as const,
      durationMs: 1000,
      totalTokens: 100,
      cost: 0.001,
    },
    summaries: {
      stepName: "summaries" as const,
      status: "completed" as const,
      durationMs: 1000,
      totalTokens: 100,
      cost: 0.001,
    },
    cruxes: {
      stepName: "cruxes" as const,
      status: "skipped" as const,
    },
  });

  // Helper to create completed results with minimal test data
  const createCompletedResults = (): PipelineState["completedResults"] => ({
    clustering: {
      data: [],
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      cost: 0.001,
    },
    claims: {
      data: {},
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      cost: 0.001,
    },
    sort_and_deduplicate: {
      data: [
        [
          TEST_STRINGS.topic,
          {
            topics: [],
            speakers: [],
            counts: { claims: 1, speakers: 1 },
          },
        ],
      ],
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      cost: 0.001,
    },
    summaries: {
      data: [],
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      cost: 0.001,
    },
  });

  // Helper to create completed pipeline state for orphan tests
  const createCompletedState = (): PipelineState => ({
    version: "1.0",
    reportId: TEST_IDS.report,
    userId: TEST_IDS.user,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "completed",
    stepAnalytics: createCompletedStepAnalytics(),
    completedResults: createCompletedResults(),
    validationFailures: {
      clustering: 0,
      claims: 0,
      sort_and_deduplicate: 0,
      summaries: 0,
      cruxes: 0,
    },
    totalTokens: 400,
    totalCost: 0.004,
    totalDurationMs: 4000,
  });

  it("should skip when GCS file exists and Firestore status is completed", async () => {
    const message = createMockMessage();

    // Lock should be acquired to check storage atomically
    vi.mocked(mockStateStore.acquirePipelineLock).mockResolvedValue(true);

    // GCS file exists
    vi.mocked(mockStorage.fileExists).mockResolvedValue({ exists: true });

    // Firestore shows completed status
    vi.mocked(mockRefStore.Report.get).mockResolvedValue({
      id: TEST_IDS.report,
      userId: TEST_IDS.user,
      reportDataUri: TEST_STORAGE.url(TEST_IDS.report),
      title: TEST_STRINGS.title,
      description: TEST_STRINGS.description,
      numTopics: 5,
      numSubtopics: 10,
      numClaims: 20,
      numPeople: 15,
      status: "completed",
      createdDate: new Date(),
      lastStatusUpdate: new Date(),
    });

    const result = await handlePipelineJob(
      message,
      mockStateStore,
      mockStorage,
      mockRefStore,
    );

    // Should skip successfully
    expect(result.tag).toBe("success");
    expect(mockStorage.fileExists).toHaveBeenCalledWith(
      TEST_STORAGE.filename(TEST_IDS.report),
    );
    expect(mockRefStore.Report.get).toHaveBeenCalledWith(TEST_IDS.report);

    // Lock should be acquired (to prevent race condition) but pipeline should not run
    expect(mockStateStore.acquirePipelineLock).toHaveBeenCalled();
    const { runPipeline } = await import("../../pipeline-runner/index.js");
    expect(runPipeline).not.toHaveBeenCalled();
  });

  it("should detect orphaned file and complete when GCS exists but Firestore is processing", async () => {
    const message = createMockMessage();

    // GCS file exists (orphaned from failed rollback)
    vi.mocked(mockStorage.fileExists).mockResolvedValue({ exists: true });

    // Firestore still shows processing (rollback failed to delete GCS file)
    vi.mocked(mockRefStore.Report.get).mockResolvedValue({
      id: TEST_IDS.report,
      userId: TEST_IDS.user,
      reportDataUri: "",
      title: TEST_STRINGS.title,
      description: TEST_STRINGS.description,
      numTopics: 0,
      numSubtopics: 0,
      numClaims: 0,
      numPeople: 0,
      status: "processing",
      createdDate: new Date(),
      lastStatusUpdate: new Date(),
    });

    // Mock completed state in Redis
    vi.mocked(mockStateStore.get).mockResolvedValue(createCompletedState());

    vi.mocked(mockStateStore.acquirePipelineLock).mockResolvedValue(true);
    vi.mocked(mockStateStore.releasePipelineLock).mockResolvedValue(true);
    vi.mocked(mockStorage.storeFile).mockResolvedValue(
      TEST_STORAGE.url(TEST_IDS.report),
    );
    vi.mocked(mockRefStore.Report.modify).mockResolvedValue(undefined);

    const result = await handlePipelineJob(
      message,
      mockStateStore,
      mockStorage,
      mockRefStore,
    );

    // Should complete successfully by reconstructing from state
    expect(result.tag).toBe("success");

    // Should detect orphan and proceed
    expect(mockStorage.fileExists).toHaveBeenCalled();
    expect(mockRefStore.Report.get).toHaveBeenCalledTimes(2); // Once for orphan check, once for save

    // Should complete the report by updating Firestore
    expect(mockRefStore.Report.modify).toHaveBeenCalledWith(
      TEST_IDS.report,
      expect.objectContaining({
        status: "completed",
        reportDataUri: TEST_STORAGE.url(TEST_IDS.report),
      }),
    );
  });

  it("should handle Firestore read error during orphan check gracefully", async () => {
    const message = createMockMessage();

    // Lock should be acquired to check storage atomically
    vi.mocked(mockStateStore.acquirePipelineLock).mockResolvedValue(true);

    // GCS file exists
    vi.mocked(mockStorage.fileExists).mockResolvedValue({ exists: true });

    // Firestore read fails
    vi.mocked(mockRefStore.Report.get).mockRejectedValue(
      new Error("Firestore read timeout"),
    );

    const result = await handlePipelineJob(
      message,
      mockStateStore,
      mockStorage,
      mockRefStore,
    );

    // Should fail with storage error (transient)
    expect(result.tag).toBe("failure");
    if (result.tag === "failure") {
      expect(result.error.message).toContain(
        "Failed to verify Firestore status",
      );
    }

    // Lock should be acquired (to prevent race condition) but should fail during storage check
    expect(mockStateStore.acquirePipelineLock).toHaveBeenCalled();
  });

  it("should detect orphaned file when Firestore status is failed and not skip", async () => {
    const message = createMockMessage();

    // Lock should be acquired to check storage atomically
    vi.mocked(mockStateStore.acquirePipelineLock).mockResolvedValue(true);

    // GCS file exists (orphaned from a previous failed attempt)
    vi.mocked(mockStorage.fileExists).mockResolvedValue({ exists: true });

    // Firestore shows failed status - should NOT skip
    vi.mocked(mockRefStore.Report.get).mockResolvedValue({
      id: TEST_IDS.report,
      userId: TEST_IDS.user,
      reportDataUri: "",
      title: TEST_STRINGS.title,
      description: TEST_STRINGS.description,
      numTopics: 0,
      numSubtopics: 0,
      numClaims: 0,
      numPeople: 0,
      status: "failed",
      errorMessage: "Previous failure",
      createdDate: new Date(),
      lastStatusUpdate: new Date(),
    });

    // Mock state for retry attempt
    vi.mocked(mockStateStore.get).mockResolvedValue(null);

    const result = await handlePipelineJob(
      message,
      mockStateStore,
      mockStorage,
      mockRefStore,
    );

    // Should have checked for orphan
    expect(mockRefStore.Report.get).toHaveBeenCalled();

    // Should have attempted to acquire lock (not skipped)
    expect(mockStateStore.acquirePipelineLock).toHaveBeenCalled();
  });
});

describe("categorizeError", () => {
  describe("GCS HTTP status code errors (numeric codes)", () => {
    it("should categorize transient errors as retryable", () => {
      const transientCodes = [408, 429, 500, 503, 504, 599];

      for (const code of transientCodes) {
        const error = new Error(`HTTP ${code} error`) as Error & {
          code: number;
        };
        error.code = code;
        expect(categorizeError(error)).toBe(true);
      }
    });

    it("should categorize permission errors as non-retryable", () => {
      const permissionCodes = [401, 403];

      for (const code of permissionCodes) {
        const error = new Error(`HTTP ${code} error`) as Error & {
          code: number;
        };
        error.code = code;
        expect(categorizeError(error)).toBe(false);
      }
    });

    it("should categorize not found errors as non-retryable", () => {
      const notFoundCodes = [404, 410];

      for (const code of notFoundCodes) {
        const error = new Error(`HTTP ${code} error`) as Error & {
          code: number;
        };
        error.code = code;
        expect(categorizeError(error)).toBe(false);
      }
    });

    it("should categorize other 4xx client errors as non-retryable", () => {
      const clientErrorCodes = [400, 405, 409, 422];

      for (const code of clientErrorCodes) {
        const error = new Error(`HTTP ${code} error`) as Error & {
          code: number;
        };
        error.code = code;
        expect(categorizeError(error)).toBe(false);
      }
    });
  });

  describe("Firestore string code errors", () => {
    it("should categorize transient Firestore errors as retryable", () => {
      const transientCodes = [
        "unavailable",
        "deadline-exceeded",
        "resource-exhausted",
        "aborted",
        "cancelled",
        "internal",
      ];

      for (const code of transientCodes) {
        const error = new Error(`Firestore error: ${code}`) as Error & {
          code: string;
        };
        error.code = code;
        expect(categorizeError(error)).toBe(true);
      }
    });

    it("should categorize permanent Firestore errors as non-retryable", () => {
      const permanentCodes = [
        "permission-denied",
        "unauthenticated",
        "not-found",
        "already-exists",
        "failed-precondition",
        "invalid-argument",
        "out-of-range",
        "unimplemented",
        "data-loss",
      ];

      for (const code of permanentCodes) {
        const error = new Error(`Firestore error: ${code}`) as Error & {
          code: string;
        };
        error.code = code;
        expect(categorizeError(error)).toBe(false);
      }
    });

    it("should handle case-insensitive Firestore error codes", () => {
      const uppercaseError = new Error("UNAVAILABLE") as Error & {
        code: string;
      };
      uppercaseError.code = "UNAVAILABLE";
      expect(categorizeError(uppercaseError)).toBe(true);

      const mixedCaseError = new Error("Permission-Denied") as Error & {
        code: string;
      };
      mixedCaseError.code = "Permission-Denied";
      expect(categorizeError(mixedCaseError)).toBe(false);
    });
  });

  describe("String pattern matching fallback", () => {
    it("should detect transient errors from message patterns", () => {
      const transientPatterns = [
        "Connection timeout occurred",
        "Error: ETIMEDOUT",
        "ECONNREFUSED",
        "ECONNRESET",
        "Service unavailable",
        "Server returned 503",
        "Gateway timeout 504",
        "Rate limit 429",
        "deadline exceeded",
      ];

      for (const pattern of transientPatterns) {
        const error = new Error(pattern);
        expect(categorizeError(error)).toBe(true);
      }
    });

    it("should detect permanent errors from message patterns", () => {
      const permanentPatterns = [
        "Permission denied",
        "Access denied to resource",
        "Unauthorized access",
        "Forbidden operation",
        "Resource not found",
        "No such object exists",
        "Invalid argument provided",
        "Error 403",
        "Error 401",
        "Error 404",
      ];

      for (const pattern of permanentPatterns) {
        const error = new Error(pattern);
        expect(categorizeError(error)).toBe(false);
      }
    });

    it("should handle case-insensitive pattern matching", () => {
      expect(categorizeError(new Error("TIMEOUT ERROR"))).toBe(true);
      expect(categorizeError(new Error("permission DENIED"))).toBe(false);
    });
  });

  describe("Unknown and edge cases", () => {
    it("should default unknown errors to non-retryable", () => {
      const unknownError = new Error("Some random error");
      expect(categorizeError(unknownError)).toBe(false);
    });

    it("should handle non-Error objects", () => {
      expect(categorizeError("string error")).toBe(false);
      expect(categorizeError(null)).toBe(false);
      expect(categorizeError(undefined)).toBe(false);
      expect(categorizeError({ message: "object error" })).toBe(false);
    });

    it("should handle errors with numeric code but outside known ranges", () => {
      const error = new Error("HTTP 200 OK") as Error & { code: number };
      error.code = 200;
      expect(categorizeError(error)).toBe(false);
    });

    it("should handle errors with unknown string codes", () => {
      const error = new Error("Unknown error") as Error & { code: string };
      error.code = "unknown-error-code";
      expect(categorizeError(error)).toBe(false);
    });
  });

  describe("Real-world error scenarios", () => {
    it("should correctly categorize GCS ApiError with 403", () => {
      const gcsError = new Error("Forbidden") as Error & {
        code: number;
        errors?: unknown[];
      };
      gcsError.code = 403;
      gcsError.errors = [{ reason: "forbidden" }];
      expect(categorizeError(gcsError)).toBe(false);
    });

    it("should correctly categorize Firestore permission-denied", () => {
      const firestoreError = new Error(
        "Missing or insufficient permissions",
      ) as Error & { code: string };
      firestoreError.code = "permission-denied";
      expect(categorizeError(firestoreError)).toBe(false);
    });

    it("should correctly categorize transient network timeout", () => {
      const timeoutError = new Error("Request timeout") as Error & {
        code: number;
      };
      timeoutError.code = 504;
      expect(categorizeError(timeoutError)).toBe(true);
    });

    it("should correctly categorize Firestore unavailable error", () => {
      const unavailableError = new Error(
        "The service is currently unavailable",
      ) as Error & { code: string };
      unavailableError.code = "unavailable";
      expect(categorizeError(unavailableError)).toBe(true);
    });
  });
});
