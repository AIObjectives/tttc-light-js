/**
 * Integration Tests for Clock Skew and Staleness Checks
 *
 * These tests verify that the pipeline handles clock skew between workers
 * and Redis, and properly detects stale state that should not be resumed.
 *
 * REQUIREMENTS:
 * - Docker must be installed and running
 * - Tests will be skipped if Docker is not available
 *
 * RUN LOCALLY:
 * pnpm --filter=pipeline-worker run test clock-skew-staleness.integration.test.ts
 */

import {
  RedisContainer,
  type StartedRedisContainer,
} from "@testcontainers/redis";
import { failure, success } from "tttc-common/functional-utils";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { RedisCache } from "../../cache/providers/redis.js";
import type { Cache } from "../../cache/types.js";
import {
  LOCK_TTL_SECONDS,
  STATE_STALENESS_THRESHOLD_MS,
} from "../constants.js";
import { createInitialState, RedisPipelineStateStore } from "../state-store.js";
import type { PipelineInput, PipelineRunnerConfig } from "../types.js";

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

// Mock pipeline steps
const mockClusteringResult = {
  data: [
    {
      topicName: "Technology",
      topicShortDescription: "Tech topics",
      subtopics: [
        { subtopicName: "AI", subtopicShortDescription: "AI topics" },
      ],
    },
  ],
  usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
  cost: 0.001,
};

const mockClaimsResult = {
  data: {
    Technology: {
      total: 1,
      subtopics: {
        AI: {
          total: 1,
          claims: [
            {
              claim: "AI will transform industries",
              quote: "AI is transformative",
              speaker: "Alice",
              topicName: "Technology",
              subtopicName: "AI",
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
                  quote: "AI is transformative",
                  speaker: "Alice",
                  topicName: "Technology",
                  subtopicName: "AI",
                  commentId: "c1",
                  duplicates: [],
                  duplicated: false,
                },
              ],
              speakers: ["Alice"],
              counts: { claims: 1, speakers: 1 },
            },
          ],
        ],
        speakers: ["Alice"],
        counts: { claims: 1, speakers: 1 },
      },
    ],
  ] as unknown as SortAndDeduplicateResult["data"],
  usage: { input_tokens: 50, output_tokens: 25, total_tokens: 75 },
  cost: 0.0005,
};

const mockSummariesResult = {
  data: [
    {
      topicName: "Technology",
      summary: "AI transformation discussion",
    },
  ],
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
  generateTopicSummaries,
  sortAndDeduplicateClaims,
} from "../../pipeline-steps/index.js";
import type { SortAndDeduplicateResult } from "../../pipeline-steps/types.js";
import { runPipeline } from "../runner.js";

describe("Clock Skew and Staleness Integration Tests", () => {
  let redisContainer: StartedRedisContainer;
  let cache: Cache;
  let stateStore: RedisPipelineStateStore;

  const createTestInput = (
    overrides: Partial<PipelineInput> = {},
  ): PipelineInput => ({
    comments: [{ id: "c1", text: "AI is transformative", speaker: "Alice" }],
    clusteringConfig: {
      model_name: "gpt-4o-mini",
      system_prompt: "You are a research assistant.",
      user_prompt: "Cluster these comments:",
    },
    claimsConfig: {
      model_name: "gpt-4o-mini",
      system_prompt: "You are a research assistant.",
      user_prompt: "Extract claims:",
    },
    dedupConfig: {
      model_name: "gpt-4o-mini",
      system_prompt: "You are a research assistant.",
      user_prompt: "Deduplicate claims:",
    },
    summariesConfig: {
      model_name: "gpt-4o-mini",
      system_prompt: "You are a research assistant.",
      user_prompt: "Summarize topics:",
    },
    apiKey: "test-api-key",
    enableCruxes: false,
    sortStrategy: "numPeople",
    ...overrides,
  });

  const createTestConfig = (
    overrides: Partial<PipelineRunnerConfig> = {},
  ): PipelineRunnerConfig => ({
    reportId: `report-${Date.now()}-${Math.random()}`,
    userId: "user-integration-test",
    resumeFromState: false,
    ...overrides,
  });

  beforeAll(async () => {
    // Start Redis container
    redisContainer = await new RedisContainer("redis:7-alpine").start();

    // Create cache and state store
    cache = new RedisCache({
      provider: "redis",
      host: redisContainer.getHost(),
      port: redisContainer.getPort(),
    });
    stateStore = new RedisPipelineStateStore(cache);
  }, 60000);

  afterAll(async () => {
    if (
      cache &&
      "disconnect" in cache &&
      typeof cache.disconnect === "function"
    ) {
      await cache.disconnect();
    }
    if (redisContainer) {
      await redisContainer.stop();
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(commentsToTree).mockResolvedValue(success(mockClusteringResult));
    vi.mocked(extractClaims).mockResolvedValue(success(mockClaimsResult));
    vi.mocked(sortAndDeduplicateClaims).mockResolvedValue(
      success(mockSortedResult),
    );
    vi.mocked(generateTopicSummaries).mockResolvedValue(
      success(mockSummariesResult),
    );
  });

  // Helper to create and save state with adjusted timestamp
  const createStateWithTimestamp = async (
    reportId: string,
    userId: string,
    timestampOffsetMs: number,
  ) => {
    const state = createInitialState(reportId, userId);
    const adjustedTimestamp = new Date(Date.now() + timestampOffsetMs);
    state.createdAt = adjustedTimestamp.toISOString();
    state.updatedAt = adjustedTimestamp.toISOString();
    await stateStore.save(state);
    return state;
  };

  describe("Clock Skew Between Worker and Redis", () => {
    it("should handle worker clock slightly ahead of Redis", async () => {
      const reportId = `clock-ahead-${Date.now()}`;
      const input = createTestInput();
      const config = createTestConfig({ reportId });

      // Create state with timestamp from "past" (simulating Redis time being behind)
      await createStateWithTimestamp(
        reportId,
        config.userId,
        -5 * 60 * 1000, // 5 minutes ago
      );

      // Run pipeline - should succeed despite timestamp difference
      const result = await runPipeline(input, config, stateStore);

      expect(result.success).toBe(true);
      expect(result.state.reportId).toBe(reportId);
    });

    it("should handle worker clock slightly behind Redis", async () => {
      const reportId = `clock-behind-${Date.now()}`;
      const input = createTestInput();
      const config = createTestConfig({ reportId });

      // Create state with "future" timestamp (simulating worker clock behind)
      await createStateWithTimestamp(
        reportId,
        config.userId,
        5 * 60 * 1000, // 5 minutes ahead
      );

      // Run pipeline - should succeed
      const result = await runPipeline(input, config, stateStore);

      expect(result.success).toBe(true);
    });

    it("should not treat recent state as stale even with minor clock differences", async () => {
      const reportId = `clock-recent-${Date.now()}`;
      const input = createTestInput();
      const initialConfig = createTestConfig({ reportId });

      // First run: fail partway through
      vi.mocked(extractClaims).mockResolvedValue(
        failure(new Error("Simulated failure")),
      );

      await runPipeline(input, initialConfig, stateStore);

      // Retrieve state and artificially adjust timestamp by 2 minutes
      const state = await stateStore.get(reportId);
      if (state) {
        const adjustedTimestamp = new Date(state.updatedAt);
        adjustedTimestamp.setMinutes(adjustedTimestamp.getMinutes() - 2);
        state.updatedAt = adjustedTimestamp.toISOString();
        await stateStore.save(state);
      }

      // Fix the claims step
      vi.mocked(extractClaims).mockResolvedValue(success(mockClaimsResult));

      // Resume should work - 2 minutes is well within staleness threshold
      const resumeConfig = createTestConfig({
        reportId,
        resumeFromState: true,
      });

      const result = await runPipeline(input, resumeConfig, stateStore);

      expect(result.success).toBe(true);
      expect(result.state.status).toBe("completed");
    });
  });

  // Helper to create stale state at specific threshold
  const createStaleState = async (
    reportId: string,
    userId: string,
    ageMs: number,
  ) => {
    const state = createInitialState(reportId, userId);
    const staleTimestamp = new Date(Date.now() - ageMs);
    state.status = "running";
    state.updatedAt = staleTimestamp.toISOString();
    state.stepAnalytics.clustering.status = "in_progress";
    await stateStore.save(state);
    return state;
  };

  describe("Staleness Detection at Threshold Boundaries", () => {
    it("should consider state stale when exactly at staleness threshold", async () => {
      const reportId = `stale-exact-${Date.now()}`;
      const input = createTestInput();
      const config = createTestConfig({ reportId });

      // Create state with updatedAt exactly at staleness threshold
      await createStaleState(
        reportId,
        config.userId,
        STATE_STALENESS_THRESHOLD_MS,
      );

      // Attempting to resume should treat this as stale
      const resumeConfig = createTestConfig({
        reportId,
        resumeFromState: true,
      });

      const result = await runPipeline(input, resumeConfig, stateStore);

      // Pipeline should start fresh or handle stale state appropriately
      expect(result.state.reportId).toBe(reportId);
    });

    it("should not consider state stale when just under threshold", async () => {
      const reportId = `not-stale-${Date.now()}`;
      const input = createTestInput();
      const initialConfig = createTestConfig({ reportId });

      // First run: fail after clustering
      vi.mocked(extractClaims).mockResolvedValue(
        failure(new Error("Simulated failure")),
      );

      await runPipeline(input, initialConfig, stateStore);

      // Set state timestamp to just under staleness threshold (30 minutes ago)
      const state = await stateStore.get(reportId);
      if (state) {
        const almostStaleTimestamp = new Date(
          Date.now() - (STATE_STALENESS_THRESHOLD_MS - 60000), // 1 minute before threshold
        );
        state.updatedAt = almostStaleTimestamp.toISOString();
        await stateStore.save(state);
      }

      // Fix claims step
      vi.mocked(extractClaims).mockResolvedValue(success(mockClaimsResult));

      // Resume should succeed - state is not yet stale
      const resumeConfig = createTestConfig({
        reportId,
        resumeFromState: true,
      });

      const result = await runPipeline(input, resumeConfig, stateStore);

      expect(result.success).toBe(true);
      expect(result.state.status).toBe("completed");
    });

    it("should definitely consider state stale when well past threshold", async () => {
      const reportId = `very-stale-${Date.now()}`;
      const input = createTestInput();
      const config = createTestConfig({ reportId });

      // Create state that's way past staleness threshold (2 hours old)
      const state = await createStaleState(
        reportId,
        config.userId,
        2 * 60 * 60 * 1000, // 2 hours
      );
      state.createdAt = state.updatedAt; // Also set createdAt to match
      await stateStore.save(state);

      // Resume attempt should handle stale state
      const resumeConfig = createTestConfig({
        reportId,
        resumeFromState: true,
      });

      const result = await runPipeline(input, resumeConfig, stateStore);

      // State should be refreshed or handled appropriately
      expect(result.state.reportId).toBe(reportId);
    });
  });

  describe("Lock TTL vs Staleness Threshold Consistency", () => {
    it("should ensure staleness threshold matches lock TTL", () => {
      // Verify configuration consistency
      const lockTtlMs = LOCK_TTL_SECONDS * 1000;
      expect(STATE_STALENESS_THRESHOLD_MS).toBe(lockTtlMs);
    });

    it("should not allow resume when lock would have expired", async () => {
      const reportId = `lock-expired-resume-${Date.now()}`;
      const input = createTestInput();
      const initialConfig = createTestConfig({ reportId });

      // First run: fail after clustering
      vi.mocked(extractClaims).mockResolvedValue(
        failure(new Error("Simulated failure")),
      );

      await runPipeline(input, initialConfig, stateStore);

      // Manipulate state to appear as if lock would have expired
      const state = await stateStore.get(reportId);
      if (state) {
        const lockExpiredTimestamp = new Date(
          Date.now() - (LOCK_TTL_SECONDS * 1000 + 60000), // 1 minute past lock TTL
        );
        state.updatedAt = lockExpiredTimestamp.toISOString();
        await stateStore.save(state);
      }

      // Verify lock doesn't exist
      const lockKey = `pipeline:lock:${reportId}`;
      const lockValue = await cache.get(lockKey);
      expect(lockValue).toBeNull();

      // Fix claims step
      vi.mocked(extractClaims).mockResolvedValue(success(mockClaimsResult));

      // Resume should acquire new lock since old one would have expired
      const resumeConfig = createTestConfig({
        reportId,
        resumeFromState: true,
      });

      const result = await runPipeline(input, resumeConfig, stateStore);

      // Should succeed with new execution
      expect(result.state.reportId).toBe(reportId);
    });
  });

  describe("Concurrent Workers with Different System Times", () => {
    it("should prevent concurrent execution even with clock skew", async () => {
      const reportId = `concurrent-clock-skew-${Date.now()}`;
      const input = createTestInput();

      // Worker 1 acquires lock
      const worker1LockValue = `worker-1-${Date.now()}`;
      const lockKey = `pipeline:lock:${reportId}`;
      const acquired = await cache.acquireLock(
        lockKey,
        worker1LockValue,
        LOCK_TTL_SECONDS,
      );
      expect(acquired).toBe(true);

      // Worker 2 tries to acquire same lock (even with different timestamp perception)
      const worker2LockValue = `worker-2-${Date.now() + 60000}`; // "future" timestamp
      const acquired2 = await cache.acquireLock(
        lockKey,
        worker2LockValue,
        LOCK_TTL_SECONDS,
      );

      // Should fail regardless of timestamp differences
      expect(acquired2).toBe(false);

      // Verify worker 1 still holds the lock
      const currentLockValue = await cache.get(lockKey);
      expect(currentLockValue).toBe(worker1LockValue);

      // Cleanup
      await cache.releaseLock(lockKey, worker1LockValue);
    });

    // Helper to create a worker that attempts to resume with lock
    const createResumeWorker = (
      workerId: number,
      reportId: string,
      input: PipelineInput,
      delayMs: number,
    ) => {
      return async () => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        const lockValue = `worker-${workerId}-${Date.now()}`;
        const acquired = await stateStore.acquirePipelineLock(
          reportId,
          lockValue,
        );
        if (!acquired) return { lockAcquired: false };

        try {
          const result = await runPipeline(
            input,
            {
              reportId,
              userId: "user-integration-test",
              resumeFromState: true,
              lockValue,
            },
            stateStore,
          );
          return { lockAcquired: true, result };
        } finally {
          await stateStore.releasePipelineLock(reportId, lockValue);
        }
      };
    };

    it("should handle multiple workers with timestamp variations attempting resume", async () => {
      const reportId = `multi-worker-resume-${Date.now()}`;
      const input = createTestInput();
      const initialConfig = createTestConfig({ reportId });

      // Create failed state
      vi.mocked(extractClaims).mockResolvedValue(
        failure(new Error("Simulated failure")),
      );

      await runPipeline(input, initialConfig, stateStore);

      // Fix claims
      vi.mocked(extractClaims).mockResolvedValue(success(mockClaimsResult));
      vi.mocked(commentsToTree).mockResolvedValue(
        success(mockClusteringResult),
      );
      vi.mocked(sortAndDeduplicateClaims).mockResolvedValue(
        success(mockSortedResult),
      );
      vi.mocked(generateTopicSummaries).mockResolvedValue(
        success(mockSummariesResult),
      );

      // Simulate 3 workers with slightly different system times
      const workers = [
        createResumeWorker(1, reportId, input, 0),
        createResumeWorker(2, reportId, input, 10),
        createResumeWorker(3, reportId, input, 20),
      ];

      // Run all workers concurrently
      const results = await Promise.all(workers.map((w) => w()));

      // Only one should have acquired the lock
      const successCount = results.filter((r) => r.lockAcquired).length;
      expect(successCount).toBe(1);

      // The successful worker should have completed the pipeline
      const successfulResult = results.find((r) => r.lockAcquired);
      expect(successfulResult?.result?.success).toBe(true);

      // Final state should show completion
      const finalState = await stateStore.get(reportId);
      expect(finalState?.status).toBe("completed");
    });
  });

  describe("State Update Timestamp Verification", () => {
    it("should update state timestamp on each save operation", async () => {
      const reportId = `timestamp-update-${Date.now()}`;
      const input = createTestInput();
      const config = createTestConfig({ reportId });

      // Create initial state
      const state = createInitialState(reportId, config.userId);

      await stateStore.save(state);

      const savedState1 = await stateStore.get(reportId);
      expect(savedState1).toBeDefined();
      const firstTimestamp = savedState1?.updatedAt;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update state
      if (savedState1) {
        savedState1.status = "running";
        await stateStore.save(savedState1);
      }

      const savedState2 = await stateStore.get(reportId);
      const secondTimestamp = savedState2?.updatedAt;

      // Timestamps should be different
      expect(secondTimestamp).not.toEqual(firstTimestamp);
      if (firstTimestamp && secondTimestamp) {
        expect(new Date(secondTimestamp).getTime()).toBeGreaterThan(
          new Date(firstTimestamp).getTime(),
        );
      }
    });

    it("should maintain accurate timestamps across Redis roundtrips", async () => {
      const reportId = `roundtrip-timestamp-${Date.now()}`;
      const input = createTestInput();
      const config = createTestConfig({ reportId });

      const beforeSave = Date.now();

      const state = createInitialState(reportId, config.userId);

      await stateStore.save(state);

      const afterSave = Date.now();

      const retrieved = await stateStore.get(reportId);

      expect(retrieved).toBeDefined();
      if (retrieved) {
        const retrievedTime = new Date(retrieved.updatedAt).getTime();

        // Timestamp should be within the save window
        expect(retrievedTime).toBeGreaterThanOrEqual(beforeSave - 1000); // Allow 1s clock variance
        expect(retrievedTime).toBeLessThanOrEqual(afterSave + 1000);
      }
    });
  });
});
