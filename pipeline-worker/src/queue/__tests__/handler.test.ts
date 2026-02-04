import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BucketStore } from "../../bucketstore/index.js";
import type { RefStoreServices } from "../../datastore/refstore/index.js";
import type { RedisPipelineStateStore } from "../../pipeline-runner/state-store.js";
import type { PipelineState } from "../../pipeline-runner/types.js";
import type { SortAndDeduplicateResult } from "../../pipeline-steps/types.js";
import { handlePipelineJob, validateDataArray } from "../handler";
import {
  createComment,
  createMockMessage,
  createMockReportRef,
  createTestMocks,
  MOCK_SORT_DEDUPE_DATA,
  TEST_ERRORS,
  TEST_IDS,
  TEST_STORAGE,
  TEST_STRINGS,
} from "./fixtures.js";
import type {
  MockData,
  MockPipelineResult,
  MockRefStore,
  MockStorage,
} from "./rollback-helpers.js";
import { saveSuccessfulPipeline } from "./rollback-helpers.js";
import {
  createCompletedState,
  createCompletedStateTyped,
  createRunningState,
} from "./state-builders.js";

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

describe("saveSuccessfulPipeline rollback behavior", () => {
  const createMockPipelineResult = (): MockPipelineResult => ({
    sortedTree: [["topic1", { topics: [], counts: { claims: 5 } }]],
    completedAt: new Date().toISOString(),
  });

  const _createMockData = (): MockData => ({
    reportDetails: {
      title: TEST_STRINGS.title,
      description: TEST_STRINGS.description,
    },
    data: [{ id: "1", comment: "test", interview: "user1" }],
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
    vi.mocked(mockRefStore.Report.get).mockResolvedValue(createMockReportRef());

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

    vi.mocked(mockRefStore.Report.get).mockResolvedValue(createMockReportRef());

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
    data: MOCK_SORT_DEDUPE_DATA,
    usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
    cost: 0.001,
  };

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
    const completedState = createCompletedStateTyped();
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
    vi.mocked(mockRefStore.Report.get).mockResolvedValue(
      createMockReportRef({
        reportDataUri: TEST_STORAGE.url(TEST_IDS.report),
        numTopics: 5,
        numSubtopics: 10,
        numClaims: 20,
        numPeople: 15,
      }),
    );
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
    const incompletedState = createCompletedStateTyped();
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
    const completedState = createCompletedStateTyped();
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

    vi.mocked(mockRefStore.Report.get).mockResolvedValue(
      createMockReportRef({
        reportDataUri: TEST_STORAGE.url(TEST_IDS.report),
        numTopics: 5,
        numSubtopics: 10,
        numClaims: 20,
        numPeople: 15,
      }),
    );
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
    vi.mocked(mockRefStore.Report.get).mockResolvedValue(
      createMockReportRef({
        reportDataUri: TEST_STORAGE.url(TEST_IDS.report),
      }),
    );
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
    vi.mocked(mockRefStore.Report.get).mockResolvedValue(
      createMockReportRef({
        reportDataUri: TEST_STORAGE.url(TEST_IDS.report),
      }),
    );
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

  it("should skip when GCS file exists and Firestore status is completed", async () => {
    const message = createMockMessage();

    // Lock should be acquired to check storage atomically
    vi.mocked(mockStateStore.acquirePipelineLock).mockResolvedValue(true);

    // GCS file exists
    vi.mocked(mockStorage.fileExists).mockResolvedValue({ exists: true });

    // Firestore shows completed status
    vi.mocked(mockRefStore.Report.get).mockResolvedValue(
      createMockReportRef({
        status: "completed",
        reportDataUri: TEST_STORAGE.url(TEST_IDS.report),
        numTopics: 5,
        numSubtopics: 10,
        numClaims: 20,
        numPeople: 15,
      }),
    );

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
    vi.mocked(mockRefStore.Report.get).mockResolvedValue(createMockReportRef());

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
    vi.mocked(mockRefStore.Report.get).mockResolvedValue(
      createMockReportRef({
        status: "failed",
        errorMessage: "Previous failure",
      }),
    );

    // Mock state for retry attempt
    vi.mocked(mockStateStore.get).mockResolvedValue(null);

    const _result = await handlePipelineJob(
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
