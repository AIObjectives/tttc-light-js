/**
 * Integration Tests for Pipeline Runner
 *
 * These tests verify the end-to-end pipeline flow with mocked external dependencies
 * but real state management and step orchestration logic.
 */

import { failure, success } from "tttc-common/functional-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cache } from "../../cache/types.js";
import { RedisPipelineStateStore } from "../state-store.js";
import type { PipelineInput, PipelineRunnerConfig } from "../types.js";

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

// Mock pipeline steps with controllable delays to simulate real execution
// Simulate realistic step execution time for integration tests
const MOCK_STEP_DELAY_MS = 50;

const mockWithDelay = <T>(result: T, delayMs: number = MOCK_STEP_DELAY_MS) => {
  return async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return success(result);
  };
};

// Test fixtures
const mockClusteringResult = {
  data: [
    {
      topicName: "Technology",
      topicShortDescription: "Discussion about technology",
      subtopics: [
        {
          subtopicName: "AI",
          subtopicShortDescription: "Artificial intelligence topics",
        },
        {
          subtopicName: "Software",
          subtopicShortDescription: "Software development topics",
        },
      ],
    },
    {
      topicName: "Environment",
      topicShortDescription: "Environmental issues",
      subtopics: [
        {
          subtopicName: "Climate",
          subtopicShortDescription: "Climate change discussions",
        },
      ],
    },
  ],
  usage: { input_tokens: 500, output_tokens: 200, total_tokens: 700 },
  cost: 0.01,
};

const mockClaimsResult = {
  data: {
    Technology: {
      total: 3,
      subtopics: {
        AI: {
          total: 2,
          claims: [
            {
              claim: "AI will transform industries",
              quote: "I think AI is going to change everything",
              speaker: "Alice",
              topicName: "Technology",
              subtopicName: "AI",
              commentId: "c1",
            },
            {
              claim: "AI needs regulation",
              quote: "We need to regulate AI carefully",
              speaker: "Bob",
              topicName: "Technology",
              subtopicName: "AI",
              commentId: "c2",
            },
          ],
        },
        Software: {
          total: 1,
          claims: [
            {
              claim: "Open source is important",
              quote: "Open source software benefits everyone",
              speaker: "Charlie",
              topicName: "Technology",
              subtopicName: "Software",
              commentId: "c3",
            },
          ],
        },
      },
    },
    Environment: {
      total: 1,
      subtopics: {
        Climate: {
          total: 1,
          claims: [
            {
              claim: "Climate action is urgent",
              quote: "We need to act now on climate",
              speaker: "Diana",
              topicName: "Environment",
              subtopicName: "Climate",
              commentId: "c4",
            },
          ],
        },
      },
    },
  },
  usage: { input_tokens: 1000, output_tokens: 500, total_tokens: 1500 },
  cost: 0.02,
};

import type { SortAndDeduplicateResult } from "../../pipeline-steps/types.js";

const mockSortedResult: SortAndDeduplicateResult = {
  data: [
    [
      "Technology",
      {
        topics: [
          [
            "AI",
            {
              claims: [
                {
                  claim: "AI will transform industries",
                  quote: "I think AI is going to change everything",
                  speaker: "Alice",
                  topicName: "Technology",
                  subtopicName: "AI",
                  commentId: "c1",
                  duplicates: [],
                  duplicated: false,
                },
              ],
              speakers: ["Alice", "Bob"],
              counts: { claims: 2, speakers: 2 },
            },
          ],
        ],
        speakers: ["Alice", "Bob", "Charlie"],
        counts: { claims: 3, speakers: 3 },
      },
    ],
    [
      "Environment",
      {
        topics: [
          [
            "Climate",
            {
              claims: [],
              speakers: ["Diana"],
              counts: { claims: 1, speakers: 1 },
            },
          ],
        ],
        speakers: ["Diana"],
        counts: { claims: 1, speakers: 1 },
      },
    ],
  ],
  usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
  cost: 0.005,
};

const mockSummariesResult = {
  data: [
    {
      topicName: "Technology",
      summary:
        "Participants discussed AI transformation and the importance of open source software.",
    },
    {
      topicName: "Environment",
      summary: "There was consensus on the urgency of climate action.",
    },
  ],
  usage: { input_tokens: 300, output_tokens: 150, total_tokens: 450 },
  cost: 0.008,
};

const mockCruxesResult = {
  subtopicCruxes: [
    {
      topic: "Technology",
      subtopic: "AI",
      cruxClaim: "AI should be regulated before deployment",
      agree: ["1:Bob"],
      disagree: ["0:Alice"],
      no_clear_position: [],
      explanation: "There is disagreement about AI regulation timing",
      agreementScore: 0.5,
      disagreementScore: 0.5,
      controversyScore: 1.0,
      speakersInvolved: 2,
      totalSpeakersInSubtopic: 2,
    },
  ],
  topicScores: [
    {
      topic: "Technology",
      averageControversy: 1.0,
      subtopicCount: 1,
      totalSpeakers: 2,
    },
  ],
  speakerCruxMatrix: {
    speakers: ["0:Alice", "1:Bob"],
    cruxLabels: ["Technology → AI"],
    matrix: [["disagree"], ["agree"]],
  },
  usage: { input_tokens: 400, output_tokens: 200, total_tokens: 600 },
  cost: 0.012,
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
import { runPipeline } from "../runner.js";

// In-memory cache for integration tests
function createInMemoryCache(): Cache {
  const storage = new Map<string, { value: string; expiresAt?: number }>();

  return {
    async get(key: string): Promise<string | null> {
      const entry = storage.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        storage.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(
      key: string,
      value: string,
      options?: { ttl?: number },
    ): Promise<void> {
      const expiresAt = options?.ttl
        ? Date.now() + options.ttl * 1000
        : undefined;
      storage.set(key, { value, expiresAt });
    },
    async delete(key: string): Promise<void> {
      storage.delete(key);
    },
    async acquireLock(
      key: string,
      value: string,
      _ttlSeconds: number,
    ): Promise<boolean> {
      const lockEntry = storage.get(key);
      if (lockEntry) return false;
      storage.set(key, { value });
      return true;
    },
    async releaseLock(key: string, value: string): Promise<boolean> {
      const lockEntry = storage.get(key);
      if (!lockEntry || lockEntry.value !== value) return false;
      storage.delete(key);
      return true;
    },
    async extendLock(
      key: string,
      value: string,
      ttlSeconds: number,
    ): Promise<boolean> {
      const lockEntry = storage.get(key);
      if (!lockEntry || lockEntry.value !== value) return false;
      const expiresAt = Date.now() + ttlSeconds * 1000;
      storage.set(key, { value, expiresAt });
      return true;
    },
  };
}

describe("Pipeline Runner Integration Tests", () => {
  let cache: Cache;
  let stateStore: RedisPipelineStateStore;

  const createTestInput = (
    overrides: Partial<PipelineInput> = {},
  ): PipelineInput => ({
    comments: [
      {
        id: "c1",
        text: "I think AI is going to change everything in our industry",
        speaker: "Alice",
      },
      {
        id: "c2",
        text: "We need to regulate AI carefully before it gets out of hand",
        speaker: "Bob",
      },
      {
        id: "c3",
        text: "Open source software benefits everyone in the community",
        speaker: "Charlie",
      },
      {
        id: "c4",
        text: "We need to act now on climate before it is too late",
        speaker: "Diana",
      },
    ],
    clusteringConfig: {
      model_name: "gpt-4o-mini",
      system_prompt: "You are a helpful research assistant.",
      user_prompt: "Cluster these comments into topics:",
    },
    claimsConfig: {
      model_name: "gpt-4o-mini",
      system_prompt: "You are a helpful research assistant.",
      user_prompt: "Extract claims from this comment:",
    },
    dedupConfig: {
      model_name: "gpt-4o-mini",
      system_prompt: "You are a helpful research assistant.",
      user_prompt: "Deduplicate these claims:",
    },
    summariesConfig: {
      model_name: "gpt-4o-mini",
      system_prompt: "You are a helpful research assistant.",
      user_prompt: "Summarize this topic:",
    },
    apiKey: "test-api-key",
    enableCruxes: false,
    sortStrategy: "numPeople",
    ...overrides,
  });

  const createTestConfig = (
    overrides: Partial<PipelineRunnerConfig> = {},
  ): PipelineRunnerConfig => ({
    reportId: `report-${Date.now()}`,
    userId: "user-integration-test",
    resumeFromState: false,
    ...overrides,
  });

  beforeEach(() => {
    cache = createInMemoryCache();
    stateStore = new RedisPipelineStateStore(cache);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Full Pipeline Execution", () => {
    it("should execute complete pipeline without cruxes", async () => {
      // Setup mocks
      vi.mocked(commentsToTree).mockImplementation(
        mockWithDelay(mockClusteringResult, 10),
      );
      vi.mocked(extractClaims).mockImplementation(
        mockWithDelay(mockClaimsResult, 20),
      );
      vi.mocked(sortAndDeduplicateClaims).mockImplementation(
        mockWithDelay(mockSortedResult, 10),
      );
      vi.mocked(generateTopicSummaries).mockImplementation(
        mockWithDelay(mockSummariesResult, 15),
      );

      const input = createTestInput();
      const config = createTestConfig();

      const result = await runPipeline(input, config, stateStore);

      // Verify success
      expect(result.success).toBe(true);
      expect(result.state.status).toBe("completed");

      // Verify outputs
      expect(result.outputs?.topicTree).toHaveLength(2);
      expect(result.outputs?.summaries).toHaveLength(2);
      expect(result.outputs?.cruxes).toBeUndefined();

      // Verify analytics
      expect(result.state.totalTokens).toBe(700 + 1500 + 300 + 450);
      expect(result.state.totalCost).toBeCloseTo(0.01 + 0.02 + 0.005 + 0.008);
      expect(result.state.totalDurationMs).toBeGreaterThan(0);

      // Verify step completion
      expect(result.state.stepAnalytics.clustering.status).toBe("completed");
      expect(result.state.stepAnalytics.claims.status).toBe("completed");
      expect(result.state.stepAnalytics.sort_and_deduplicate.status).toBe(
        "completed",
      );
      expect(result.state.stepAnalytics.summaries.status).toBe("completed");
      expect(result.state.stepAnalytics.cruxes.status).toBe("skipped");
    });

    it("should execute complete pipeline with cruxes", async () => {
      // Setup mocks
      vi.mocked(commentsToTree).mockImplementation(
        mockWithDelay(mockClusteringResult, 10),
      );
      vi.mocked(extractClaims).mockImplementation(
        mockWithDelay(mockClaimsResult, 20),
      );
      vi.mocked(sortAndDeduplicateClaims).mockImplementation(
        mockWithDelay(mockSortedResult, 10),
      );
      vi.mocked(generateTopicSummaries).mockImplementation(
        mockWithDelay(mockSummariesResult, 15),
      );
      vi.mocked(extractCruxes).mockImplementation(
        mockWithDelay(mockCruxesResult, 25),
      );

      const input = createTestInput({
        enableCruxes: true,
        cruxesConfig: {
          model_name: "gpt-4o-mini",
          system_prompt: "You are a helpful research assistant.",
          user_prompt: "Find cruxes in these claims:",
        },
      });
      const config = createTestConfig();

      const result = await runPipeline(input, config, stateStore);

      // Verify success
      expect(result.success).toBe(true);
      expect(result.state.status).toBe("completed");

      // Verify cruxes output
      expect(result.outputs?.cruxes).toBeDefined();
      expect(result.outputs?.cruxes?.subtopicCruxes).toHaveLength(1);

      // Verify all steps completed
      expect(result.state.stepAnalytics.cruxes.status).toBe("completed");
    });
  });

  describe("State Persistence and Recovery", () => {
    it("should persist state after each step", async () => {
      vi.mocked(commentsToTree).mockImplementation(
        mockWithDelay(mockClusteringResult, 5),
      );
      vi.mocked(extractClaims).mockImplementation(
        mockWithDelay(mockClaimsResult, 5),
      );
      vi.mocked(sortAndDeduplicateClaims).mockImplementation(
        mockWithDelay(mockSortedResult, 5),
      );
      vi.mocked(generateTopicSummaries).mockImplementation(
        mockWithDelay(mockSummariesResult, 5),
      );

      const input = createTestInput();
      const config = createTestConfig({ reportId: "persist-test-123" });

      await runPipeline(input, config, stateStore);

      // Verify state is persisted
      const persistedState = await stateStore.get("persist-test-123");
      expect(persistedState).toBeDefined();
      expect(persistedState?.status).toBe("completed");
      expect(persistedState?.completedResults.clustering).toBeDefined();
      expect(persistedState?.completedResults.claims).toBeDefined();
    });

    it("should resume from failed step", async () => {
      // First run: fail at claims step
      vi.mocked(commentsToTree).mockImplementation(
        mockWithDelay(mockClusteringResult, 5),
      );
      vi.mocked(extractClaims).mockResolvedValue(
        failure(new Error("Temporary API failure")),
      );

      const input = createTestInput();
      const config = createTestConfig({ reportId: "resume-test-456" });

      const firstResult = await runPipeline(input, config, stateStore);
      expect(firstResult.success).toBe(false);
      expect(firstResult.state.stepAnalytics.claims.status).toBe("failed");

      // Verify clustering result is persisted
      const intermediateState = await stateStore.get("resume-test-456");
      expect(intermediateState?.completedResults.clustering).toBeDefined();

      // Second run: resume and succeed
      vi.mocked(extractClaims).mockImplementation(
        mockWithDelay(mockClaimsResult, 5),
      );
      vi.mocked(sortAndDeduplicateClaims).mockImplementation(
        mockWithDelay(mockSortedResult, 5),
      );
      vi.mocked(generateTopicSummaries).mockImplementation(
        mockWithDelay(mockSummariesResult, 5),
      );

      const resumeConfig = createTestConfig({
        reportId: "resume-test-456",
        resumeFromState: true,
      });

      const secondResult = await runPipeline(input, resumeConfig, stateStore);

      // Verify success
      expect(secondResult.success).toBe(true);
      expect(secondResult.state.status).toBe("completed");

      // Verify clustering was not called again
      expect(commentsToTree).toHaveBeenCalledTimes(1);
      // Verify claims was called (for retry)
      expect(extractClaims).toHaveBeenCalledTimes(2);
    });

    it("should preserve completed results on resume", async () => {
      // First run: complete clustering and claims, fail at sort
      vi.mocked(commentsToTree).mockImplementation(
        mockWithDelay(mockClusteringResult, 5),
      );
      vi.mocked(extractClaims).mockImplementation(
        mockWithDelay(mockClaimsResult, 5),
      );
      vi.mocked(sortAndDeduplicateClaims).mockResolvedValue(
        failure(new Error("Sort failed")),
      );

      const input = createTestInput();
      const config = createTestConfig({ reportId: "preserve-test-789" });

      const firstResult = await runPipeline(input, config, stateStore);
      expect(firstResult.success).toBe(false);

      // Verify intermediate state
      const state = await stateStore.get("preserve-test-789");
      expect(state?.stepAnalytics.clustering.status).toBe("completed");
      expect(state?.stepAnalytics.claims.status).toBe("completed");
      expect(state?.stepAnalytics.sort_and_deduplicate.status).toBe("failed");

      // Resume
      vi.mocked(sortAndDeduplicateClaims).mockImplementation(
        mockWithDelay(mockSortedResult, 5),
      );
      vi.mocked(generateTopicSummaries).mockImplementation(
        mockWithDelay(mockSummariesResult, 5),
      );

      const resumeConfig = createTestConfig({
        reportId: "preserve-test-789",
        resumeFromState: true,
      });

      const secondResult = await runPipeline(input, resumeConfig, stateStore);

      // Verify success
      expect(secondResult.success).toBe(true);

      // Verify earlier steps were not repeated
      expect(commentsToTree).toHaveBeenCalledTimes(1);
      expect(extractClaims).toHaveBeenCalledTimes(1);
    });
  });

  describe("Progress Tracking", () => {
    it("should report progress during execution", async () => {
      vi.mocked(commentsToTree).mockImplementation(
        mockWithDelay(mockClusteringResult, 5),
      );
      vi.mocked(extractClaims).mockImplementation(
        mockWithDelay(mockClaimsResult, 5),
      );
      vi.mocked(sortAndDeduplicateClaims).mockImplementation(
        mockWithDelay(mockSortedResult, 5),
      );
      vi.mocked(generateTopicSummaries).mockImplementation(
        mockWithDelay(mockSummariesResult, 5),
      );

      const progressUpdates: Array<{
        currentStep: string;
        percentComplete: number;
      }> = [];
      const onProgress = vi.fn((progress) => {
        progressUpdates.push({
          currentStep: progress.currentStep,
          percentComplete: progress.percentComplete,
        });
      });

      const input = createTestInput();
      const config = createTestConfig({ onProgress });

      await runPipeline(input, config, stateStore);

      // Verify progress was reported
      expect(progressUpdates.length).toBe(4); // 4 steps without cruxes

      // Verify progress increases
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i].percentComplete).toBeGreaterThanOrEqual(
          progressUpdates[i - 1].percentComplete,
        );
      }

      // Verify final progress is 100%
      expect(progressUpdates[progressUpdates.length - 1].percentComplete).toBe(
        100,
      );
    });

    it("should track step durations", async () => {
      const stepDelays = {
        clustering: 20,
        claims: 30,
        sort: 15,
        summaries: 25,
      };

      vi.mocked(commentsToTree).mockImplementation(
        mockWithDelay(mockClusteringResult, stepDelays.clustering),
      );
      vi.mocked(extractClaims).mockImplementation(
        mockWithDelay(mockClaimsResult, stepDelays.claims),
      );
      vi.mocked(sortAndDeduplicateClaims).mockImplementation(
        mockWithDelay(mockSortedResult, stepDelays.sort),
      );
      vi.mocked(generateTopicSummaries).mockImplementation(
        mockWithDelay(mockSummariesResult, stepDelays.summaries),
      );

      const input = createTestInput();
      const config = createTestConfig();

      const result = await runPipeline(input, config, stateStore);

      // Verify each step has a duration (with tolerance for timing imprecision)
      // Allow 5ms tolerance to account for system load and JavaScript timing
      expect(
        result.state.stepAnalytics.clustering.durationMs,
      ).toBeGreaterThanOrEqual(stepDelays.clustering - 5);
      expect(
        result.state.stepAnalytics.claims.durationMs,
      ).toBeGreaterThanOrEqual(stepDelays.claims - 5);
      expect(
        result.state.stepAnalytics.sort_and_deduplicate.durationMs,
      ).toBeGreaterThanOrEqual(stepDelays.sort - 5);
      expect(
        result.state.stepAnalytics.summaries.durationMs,
      ).toBeGreaterThanOrEqual(stepDelays.summaries - 5);
    });
  });

  describe("Error Scenarios", () => {
    it("should handle all steps failing", async () => {
      vi.mocked(commentsToTree).mockResolvedValue(
        failure(new Error("Clustering API error")),
      );

      const input = createTestInput();
      const config = createTestConfig();

      const result = await runPipeline(input, config, stateStore);

      expect(result.success).toBe(false);
      expect(result.state.status).toBe("failed");
      expect(result.state.error?.step).toBe("clustering");
    });

    it("should preserve partial state on failure", async () => {
      vi.mocked(commentsToTree).mockImplementation(
        mockWithDelay(mockClusteringResult, 5),
      );
      vi.mocked(extractClaims).mockImplementation(
        mockWithDelay(mockClaimsResult, 5),
      );
      vi.mocked(sortAndDeduplicateClaims).mockImplementation(
        mockWithDelay(mockSortedResult, 5),
      );
      vi.mocked(generateTopicSummaries).mockResolvedValue(
        failure(new Error("Summary generation failed")),
      );

      const input = createTestInput();
      const config = createTestConfig({ reportId: "partial-state-test" });

      const result = await runPipeline(input, config, stateStore);

      expect(result.success).toBe(false);

      // Verify partial state is preserved
      const state = await stateStore.get("partial-state-test");
      expect(state?.completedResults.clustering).toBeDefined();
      expect(state?.completedResults.claims).toBeDefined();
      expect(state?.completedResults.sort_and_deduplicate).toBeDefined();
      expect(state?.completedResults.summaries).toBeUndefined();

      // Verify analytics for completed steps
      expect(state?.stepAnalytics.clustering.status).toBe("completed");
      expect(state?.stepAnalytics.claims.status).toBe("completed");
      expect(state?.stepAnalytics.sort_and_deduplicate.status).toBe(
        "completed",
      );
      expect(state?.stepAnalytics.summaries.status).toBe("failed");
    });
  });

  describe("Concurrent Pipeline Runs", () => {
    it("should handle multiple pipelines concurrently", async () => {
      vi.mocked(commentsToTree).mockImplementation(
        mockWithDelay(mockClusteringResult, 10),
      );
      vi.mocked(extractClaims).mockImplementation(
        mockWithDelay(mockClaimsResult, 10),
      );
      vi.mocked(sortAndDeduplicateClaims).mockImplementation(
        mockWithDelay(mockSortedResult, 10),
      );
      vi.mocked(generateTopicSummaries).mockImplementation(
        mockWithDelay(mockSummariesResult, 10),
      );

      const input = createTestInput();

      // Run two pipelines concurrently
      const [result1, result2] = await Promise.all([
        runPipeline(
          input,
          createTestConfig({ reportId: "concurrent-1" }),
          stateStore,
        ),
        runPipeline(
          input,
          createTestConfig({ reportId: "concurrent-2" }),
          stateStore,
        ),
      ]);

      // Both should succeed
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Both should have their own state
      const state1 = await stateStore.get("concurrent-1");
      const state2 = await stateStore.get("concurrent-2");

      expect(state1?.reportId).toBe("concurrent-1");
      expect(state2?.reportId).toBe("concurrent-2");
    });
  });
});
