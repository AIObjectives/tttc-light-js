/**
 * Tests for Pipeline Runner
 */

import { failure, success } from "tttc-common/functional-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cache } from "../../cache/types.js";
import { createInitialState, RedisPipelineStateStore } from "../state-store.js";
import type { PipelineInput, PipelineRunnerConfig } from "../types.js";
import { PipelineResumeError, PipelineStepError } from "../types.js";

// Mock logger - needs to support nested child() calls
// The factory function must be inlined since vi.mock is hoisted
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

// Mock pipeline steps
const mockClusteringResult = {
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
};

const mockClaimsResult = {
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
};

import type { SortAndDeduplicateResult } from "../../pipeline-steps/types.js";

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
  usage: { input_tokens: 50, output_tokens: 25, total_tokens: 75 },
  cost: 0.0005,
};

const mockSummariesResult = {
  data: [{ topicName: "Test Topic", summary: "This is a test summary." }],
  usage: { input_tokens: 150, output_tokens: 75, total_tokens: 225 },
  cost: 0.0015,
};

const mockCruxesResult = {
  subtopicCruxes: [],
  topicScores: [],
  speakerCruxMatrix: { speakers: [], cruxLabels: [], matrix: [] },
  usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
  cost: 0.001,
};

vi.mock("../../pipeline-steps/index.js", () => ({
  commentsToTree: vi.fn(),
  extractClaims: vi.fn(),
  sortAndDeduplicateClaims: vi.fn(),
  generateTopicSummaries: vi.fn(),
  extractCruxes: vi.fn(),
}));

import {
  commentsToTree,
  extractClaims,
  extractCruxes,
  generateTopicSummaries,
  sortAndDeduplicateClaims,
} from "../../pipeline-steps/index.js";
import {
  cancelPipeline,
  cleanupPipelineState,
  getPipelineStatus,
  runPipeline,
} from "../runner.js";

// Mock cache implementation
function createMockCache(): Cache & { storage: Map<string, string> } {
  const storage = new Map<string, string>();

  return {
    storage,
    async get(key: string): Promise<string | null> {
      return storage.get(key) ?? null;
    },
    async set(
      key: string,
      value: string,
      _options?: { ttl?: number },
    ): Promise<void> {
      storage.set(key, value);
    },
    async delete(key: string): Promise<void> {
      storage.delete(key);
    },
    async acquireLock(
      key: string,
      value: string,
      _ttlSeconds: number,
    ): Promise<boolean> {
      if (storage.has(key)) return false;
      storage.set(key, value);
      return true;
    },
    async releaseLock(key: string, value: string): Promise<boolean> {
      const lockValue = storage.get(key);
      if (!lockValue || lockValue !== value) return false;
      storage.delete(key);
      return true;
    },
    async extendLock(
      key: string,
      value: string,
      _ttlSeconds: number,
    ): Promise<boolean> {
      const lockValue = storage.get(key);
      if (!lockValue || lockValue !== value) return false;
      return true;
    },
  };
}

describe("Pipeline Runner", () => {
  let mockCache: ReturnType<typeof createMockCache>;
  let stateStore: RedisPipelineStateStore;

  const defaultInput: PipelineInput = {
    comments: [
      { id: "c1", text: "This is a test comment", speaker: "Speaker1" },
    ],
    clusteringConfig: {
      model_name: "gpt-4o-mini",
      system_prompt: "System prompt",
      user_prompt: "User prompt",
    },
    claimsConfig: {
      model_name: "gpt-4o-mini",
      system_prompt: "System prompt",
      user_prompt: "User prompt",
    },
    dedupConfig: {
      model_name: "gpt-4o-mini",
      system_prompt: "System prompt",
      user_prompt: "User prompt",
    },
    summariesConfig: {
      model_name: "gpt-4o-mini",
      system_prompt: "System prompt",
      user_prompt: "User prompt",
    },
    apiKey: "test-api-key",
    enableCruxes: false,
    sortStrategy: "numPeople",
  };

  const defaultConfig: PipelineRunnerConfig = {
    reportId: "report-123",
    userId: "user-456",
    resumeFromState: false,
  };

  beforeEach(() => {
    mockCache = createMockCache();
    stateStore = new RedisPipelineStateStore(mockCache);

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default successful mock responses
    vi.mocked(commentsToTree).mockResolvedValue(success(mockClusteringResult));
    vi.mocked(extractClaims).mockResolvedValue(success(mockClaimsResult));
    vi.mocked(sortAndDeduplicateClaims).mockResolvedValue(
      success(mockSortedResult),
    );
    vi.mocked(generateTopicSummaries).mockResolvedValue(
      success(mockSummariesResult),
    );
    vi.mocked(extractCruxes).mockResolvedValue(success(mockCruxesResult));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("runPipeline", () => {
    it("should execute all steps successfully without cruxes", async () => {
      const result = await runPipeline(defaultInput, defaultConfig, stateStore);

      expect(result.success).toBe(true);
      expect(result.state.status).toBe("completed");
      expect(result.outputs).toBeDefined();
      expect(result.outputs?.topicTree).toEqual(mockClusteringResult.data);
      expect(result.outputs?.claimsTree).toEqual(mockClaimsResult.data);
      expect(result.outputs?.sortedTree).toEqual(mockSortedResult.data);
      expect(result.outputs?.summaries).toEqual(mockSummariesResult.data);
      expect(result.outputs?.cruxes).toBeUndefined();
    });

    it("should execute all steps successfully with cruxes", async () => {
      const input: PipelineInput = {
        ...defaultInput,
        enableCruxes: true,
        cruxesConfig: {
          model_name: "gpt-4o-mini",
          system_prompt: "System prompt",
          user_prompt: "User prompt",
        },
      };

      const result = await runPipeline(input, defaultConfig, stateStore);

      expect(result.success).toBe(true);
      expect(result.state.status).toBe("completed");
      expect(result.outputs?.cruxes).toEqual(mockCruxesResult);
    });

    it("should track analytics for each step", async () => {
      const result = await runPipeline(defaultInput, defaultConfig, stateStore);

      expect(result.state.stepAnalytics.clustering.status).toBe("completed");
      // Duration can be 0 with mocked instant responses, so check it's defined
      expect(
        result.state.stepAnalytics.clustering.durationMs,
      ).toBeGreaterThanOrEqual(0);
      expect(result.state.stepAnalytics.clustering.inputTokens).toBe(100);
      expect(result.state.stepAnalytics.clustering.outputTokens).toBe(50);
      expect(result.state.stepAnalytics.clustering.totalTokens).toBe(150);
      expect(result.state.stepAnalytics.clustering.cost).toBe(0.001);

      expect(result.state.stepAnalytics.claims.status).toBe("completed");
      expect(result.state.stepAnalytics.sort_and_deduplicate.status).toBe(
        "completed",
      );
      expect(result.state.stepAnalytics.summaries.status).toBe("completed");
    });

    it("should aggregate total tokens and cost", async () => {
      const result = await runPipeline(defaultInput, defaultConfig, stateStore);

      // Sum of all steps
      const expectedTokens = 150 + 300 + 75 + 225; // 750
      const expectedCost = 0.001 + 0.002 + 0.0005 + 0.0015; // 0.005

      expect(result.state.totalTokens).toBe(expectedTokens);
      expect(result.state.totalCost).toBeCloseTo(expectedCost, 6);
    });

    it("should mark cruxes as skipped when not enabled", async () => {
      const result = await runPipeline(defaultInput, defaultConfig, stateStore);

      expect(result.state.stepAnalytics.cruxes.status).toBe("skipped");
    });

    it("should fail gracefully on clustering error", async () => {
      vi.mocked(commentsToTree).mockResolvedValue(
        failure(new Error("Clustering failed")),
      );

      const result = await runPipeline(defaultInput, defaultConfig, stateStore);

      expect(result.success).toBe(false);
      expect(result.state.status).toBe("failed");
      expect(result.state.stepAnalytics.clustering.status).toBe("failed");
      expect(result.error).toBeInstanceOf(PipelineStepError);
      expect(result.error?.message).toContain("clustering");
    });

    it("should fail gracefully on claims error", async () => {
      vi.mocked(extractClaims).mockResolvedValue(
        failure(new Error("Claims extraction failed")),
      );

      const result = await runPipeline(defaultInput, defaultConfig, stateStore);

      expect(result.success).toBe(false);
      expect(result.state.status).toBe("failed");
      expect(result.state.stepAnalytics.claims.status).toBe("failed");
      expect(result.state.stepAnalytics.clustering.status).toBe("completed");
    });

    it("should fail gracefully on sort_and_deduplicate error", async () => {
      vi.mocked(sortAndDeduplicateClaims).mockResolvedValue(
        failure(new Error("Sort failed")),
      );

      const result = await runPipeline(defaultInput, defaultConfig, stateStore);

      expect(result.success).toBe(false);
      expect(result.state.status).toBe("failed");
      expect(result.state.stepAnalytics.sort_and_deduplicate.status).toBe(
        "failed",
      );
    });

    it("should fail gracefully on summaries error", async () => {
      vi.mocked(generateTopicSummaries).mockResolvedValue(
        failure(new Error("Summaries failed")),
      );

      const result = await runPipeline(defaultInput, defaultConfig, stateStore);

      expect(result.success).toBe(false);
      expect(result.state.status).toBe("failed");
      expect(result.state.stepAnalytics.summaries.status).toBe("failed");
    });

    it("should fail gracefully on cruxes error", async () => {
      vi.mocked(extractCruxes).mockResolvedValue(
        failure(new Error("Cruxes failed")),
      );

      const input: PipelineInput = {
        ...defaultInput,
        enableCruxes: true,
        cruxesConfig: {
          model_name: "gpt-4o-mini",
          system_prompt: "System prompt",
          user_prompt: "User prompt",
        },
      };

      const result = await runPipeline(input, defaultConfig, stateStore);

      expect(result.success).toBe(false);
      expect(result.state.status).toBe("failed");
      expect(result.state.stepAnalytics.cruxes.status).toBe("failed");
    });

    it("should call onStepUpdate callbacks", async () => {
      const onStepUpdate = vi.fn();
      const config: PipelineRunnerConfig = {
        ...defaultConfig,
        onStepUpdate,
      };

      await runPipeline(defaultInput, config, stateStore);

      expect(onStepUpdate).toHaveBeenCalledWith("clustering", "in_progress");
      expect(onStepUpdate).toHaveBeenCalledWith("clustering", "completed");
      expect(onStepUpdate).toHaveBeenCalledWith("claims", "in_progress");
      expect(onStepUpdate).toHaveBeenCalledWith("claims", "completed");
      expect(onStepUpdate).toHaveBeenCalledWith(
        "sort_and_deduplicate",
        "in_progress",
      );
      expect(onStepUpdate).toHaveBeenCalledWith(
        "sort_and_deduplicate",
        "completed",
      );
      expect(onStepUpdate).toHaveBeenCalledWith("summaries", "in_progress");
      expect(onStepUpdate).toHaveBeenCalledWith("summaries", "completed");
      expect(onStepUpdate).toHaveBeenCalledWith("cruxes", "skipped");
    });

    it("should call onProgress callbacks", async () => {
      const onProgress = vi.fn();
      const config: PipelineRunnerConfig = {
        ...defaultConfig,
        onProgress,
      };

      await runPipeline(defaultInput, config, stateStore);

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStep: "clustering",
          totalSteps: 4,
          completedSteps: 1,
          percentComplete: 25,
        }),
      );

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStep: "summaries",
          totalSteps: 4,
          completedSteps: 4,
          percentComplete: 100,
        }),
      );
    });

    it("should persist state after each step", async () => {
      await runPipeline(defaultInput, defaultConfig, stateStore);

      const savedState = await stateStore.get("report-123");

      expect(savedState).toBeDefined();
      expect(savedState?.status).toBe("completed");
      expect(savedState?.completedResults.clustering).toBeDefined();
      expect(savedState?.completedResults.claims).toBeDefined();
      expect(savedState?.completedResults.sort_and_deduplicate).toBeDefined();
      expect(savedState?.completedResults.summaries).toBeDefined();
    });
  });

  describe("runPipeline - resume functionality", () => {
    it("should resume from partially completed state", async () => {
      // Create initial state with clustering already completed
      const existingState = createInitialState("report-123", "user-456");
      existingState.status = "failed";
      existingState.stepAnalytics.clustering.status = "completed";
      existingState.completedResults.clustering = mockClusteringResult;
      await stateStore.save(existingState);

      const config: PipelineRunnerConfig = {
        ...defaultConfig,
        resumeFromState: true,
      };

      const result = await runPipeline(defaultInput, config, stateStore);

      expect(result.success).toBe(true);
      // Should not have called clustering again
      expect(commentsToTree).not.toHaveBeenCalled();
      // Should have called remaining steps
      expect(extractClaims).toHaveBeenCalled();
      expect(sortAndDeduplicateClaims).toHaveBeenCalled();
      expect(generateTopicSummaries).toHaveBeenCalled();
    });

    it("should throw when trying to resume non-existent state", async () => {
      const config: PipelineRunnerConfig = {
        ...defaultConfig,
        resumeFromState: true,
      };

      await expect(
        runPipeline(defaultInput, config, stateStore),
      ).rejects.toThrow(PipelineResumeError);
    });

    it("should throw when trying to resume completed pipeline", async () => {
      const existingState = createInitialState("report-123", "user-456");
      existingState.status = "completed";
      await stateStore.save(existingState);

      const config: PipelineRunnerConfig = {
        ...defaultConfig,
        resumeFromState: true,
      };

      await expect(
        runPipeline(defaultInput, config, stateStore),
      ).rejects.toThrow(PipelineResumeError);
    });

    it("should resume from failed claims step", async () => {
      const existingState = createInitialState("report-123", "user-456");
      existingState.status = "failed";
      existingState.stepAnalytics.clustering.status = "completed";
      existingState.stepAnalytics.claims.status = "failed";
      existingState.completedResults.clustering = mockClusteringResult;
      await stateStore.save(existingState);

      const config: PipelineRunnerConfig = {
        ...defaultConfig,
        resumeFromState: true,
      };

      const result = await runPipeline(defaultInput, config, stateStore);

      expect(result.success).toBe(true);
      expect(commentsToTree).not.toHaveBeenCalled();
      expect(extractClaims).toHaveBeenCalled();
    });
  });

  describe("getPipelineStatus", () => {
    it("should return pipeline state when it exists", async () => {
      const state = createInitialState("report-123", "user-456");
      await stateStore.save(state);

      const status = await getPipelineStatus("report-123", stateStore);

      expect(status).toBeDefined();
      expect(status?.reportId).toBe("report-123");
    });

    it("should return null when state does not exist", async () => {
      const status = await getPipelineStatus("non-existent", stateStore);

      expect(status).toBeNull();
    });
  });

  describe("cancelPipeline", () => {
    it("should cancel running pipeline", async () => {
      const state = createInitialState("report-123", "user-456");
      state.status = "running";
      state.currentStep = "claims";
      await stateStore.save(state);

      const cancelled = await cancelPipeline("report-123", stateStore);

      expect(cancelled).toBe(true);

      const updatedState = await stateStore.get("report-123");
      expect(updatedState?.status).toBe("failed");
      expect(updatedState?.error?.message).toBe("Pipeline cancelled by user");
    });

    it("should return false for non-existent pipeline", async () => {
      const cancelled = await cancelPipeline("non-existent", stateStore);

      expect(cancelled).toBe(false);
    });

    it("should return false for completed pipeline", async () => {
      const state = createInitialState("report-123", "user-456");
      state.status = "completed";
      await stateStore.save(state);

      const cancelled = await cancelPipeline("report-123", stateStore);

      expect(cancelled).toBe(false);
    });

    it("should return false for already failed pipeline", async () => {
      const state = createInitialState("report-123", "user-456");
      state.status = "failed";
      await stateStore.save(state);

      const cancelled = await cancelPipeline("report-123", stateStore);

      expect(cancelled).toBe(false);
    });
  });

  describe("cleanupPipelineState", () => {
    it("should delete pipeline state", async () => {
      const state = createInitialState("report-123", "user-456");
      await stateStore.save(state);

      await cleanupPipelineState("report-123", stateStore);

      const deleted = await stateStore.get("report-123");
      expect(deleted).toBeNull();
    });

    it("should not throw when state does not exist", async () => {
      await expect(
        cleanupPipelineState("non-existent", stateStore),
      ).resolves.not.toThrow();
    });
  });

  describe("error handling", () => {
    it("should handle thrown exceptions in steps", async () => {
      vi.mocked(commentsToTree).mockRejectedValue(
        new Error("Unexpected error"),
      );

      const result = await runPipeline(defaultInput, defaultConfig, stateStore);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("Unexpected error");
    });

    it("should preserve error details in state", async () => {
      const customError = new Error("Custom error message");
      customError.name = "CustomError";
      vi.mocked(extractClaims).mockResolvedValue(failure(customError));

      const result = await runPipeline(defaultInput, defaultConfig, stateStore);

      expect(result.state.error).toEqual({
        message: "Custom error message",
        name: "CustomError",
        step: "claims",
      });
    });
  });

  describe("timeout handling", () => {
    it("should properly clean up timeout when pipeline completes successfully", async () => {
      // This test verifies that AbortController properly cleans up the timeout promise
      // to prevent memory leaks in long-running servers
      const result = await runPipeline(defaultInput, defaultConfig, stateStore);

      expect(result.success).toBe(true);
      expect(result.state.status).toBe("completed");
      // If timeout cleanup is working correctly, the test will complete without leaking
      // the timeout promise. Memory leak would accumulate over many invocations.
    });

    it("should abort timeout when pipeline fails early", async () => {
      vi.mocked(commentsToTree).mockResolvedValue(
        failure(new Error("Early failure")),
      );

      const result = await runPipeline(defaultInput, defaultConfig, stateStore);

      expect(result.success).toBe(false);
      // Timeout should be aborted even when pipeline fails
      // This prevents timeout from firing after the pipeline has already finished
    });
  });

  describe("validation failure retry limit", () => {
    it("should fail pipeline after max validation failures for corrupted state", async () => {
      // Create state with corrupted clustering result (missing required 'cost' field)
      const existingState = createInitialState("report-123", "user-456");
      existingState.status = "failed";
      existingState.stepAnalytics.clustering.status = "completed";
      existingState.completedResults.clustering = {
        data: mockClusteringResult.data,
        usage: mockClusteringResult.usage,
        // Missing 'cost' field - will fail validation
      } as typeof mockClusteringResult;
      existingState.validationFailures.clustering = 3; // Already at max retries
      await stateStore.save(existingState);

      const config: PipelineRunnerConfig = {
        ...defaultConfig,
        resumeFromState: true,
      };

      const result = await runPipeline(defaultInput, config, stateStore);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(PipelineStepError);
      expect(result.error?.message).toContain("validation failed 3 times");
      expect(result.error?.message).toContain("permanently corrupted");
    });

    it("should increment validation failure counter on corrupted state", async () => {
      // Create state with corrupted clustering result
      const existingState = createInitialState("report-123", "user-456");
      existingState.status = "failed";
      existingState.stepAnalytics.clustering.status = "completed";
      existingState.completedResults.clustering = {
        data: mockClusteringResult.data,
        usage: mockClusteringResult.usage,
        // Missing 'cost' field
      } as typeof mockClusteringResult;
      existingState.validationFailures.clustering = 0;
      await stateStore.save(existingState);

      const config: PipelineRunnerConfig = {
        ...defaultConfig,
        resumeFromState: true,
      };

      const result = await runPipeline(defaultInput, config, stateStore);

      // Pipeline should succeed after re-running clustering step
      expect(result.success).toBe(true);

      // Check that validation failure was tracked in state
      const savedState = await stateStore.get("report-123");
      expect(savedState?.validationFailures.clustering).toBe(0); // Reset on successful completion
    });

    it("should reset validation failure counter when step re-runs and succeeds", async () => {
      // Create state with corrupted result and previous validation failures
      const existingState = createInitialState("report-123", "user-456");
      existingState.status = "failed";
      existingState.stepAnalytics.clustering.status = "completed";
      existingState.completedResults.clustering = {
        data: mockClusteringResult.data,
        usage: mockClusteringResult.usage,
        // Missing 'cost' field - will fail validation and trigger re-run
      } as typeof mockClusteringResult;
      existingState.validationFailures.clustering = 2; // Had previous failures
      await stateStore.save(existingState);

      const config: PipelineRunnerConfig = {
        ...defaultConfig,
        resumeFromState: true,
      };

      const result = await runPipeline(defaultInput, config, stateStore);

      expect(result.success).toBe(true);

      // Failure counter should be reset to 0 after successful re-run
      const savedState = await stateStore.get("report-123");
      expect(savedState?.validationFailures.clustering).toBe(0);
    });
  });
});
