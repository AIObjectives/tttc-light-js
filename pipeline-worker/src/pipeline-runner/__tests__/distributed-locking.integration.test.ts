/**
 * Integration Tests for Distributed Locking with Real Redis
 *
 * These tests verify distributed locking behavior using a real Redis container
 * via testcontainers. They test scenarios that cannot be adequately covered
 * with in-memory mocks, including:
 * - Concurrent lock acquisition from multiple workers
 * - Lock extension during long-running operations
 * - Lock TTL expiration and automatic release
 * - State serialization roundtrip through Redis
 * - Crash recovery and state persistence
 *
 * REQUIREMENTS:
 * - Docker must be installed and running
 * - Tests will be skipped if Docker is not available
 *
 * RUN LOCALLY:
 * pnpm --filter=pipeline-worker run test distributed-locking.integration.test.ts
 *
 * RUN IN CI:
 * These tests are designed to run in CI/CD where Docker is available
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
import { isDockerAvailable } from "../../__tests__/test-helpers.js";
import { RedisCache } from "../../cache/providers/redis.js";
import type { Cache } from "../../cache/types.js";
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

// Check Docker availability before running tests
const dockerAvailable = await isDockerAvailable();

describe.skipIf(!dockerAvailable)("Distributed Locking with Real Redis", () => {
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

  describe("Concurrent Lock Acquisition", () => {
    it("should prevent concurrent lock acquisition for same pipeline", async () => {
      const reportId = `concurrent-same-${Date.now()}`;
      const lockKey = `pipeline:lock:${reportId}`;

      // First worker acquires lock
      const acquired1 = await cache.acquireLock(lockKey, "worker-1", 10);
      expect(acquired1).toBe(true);

      // Second worker tries to acquire same lock
      const acquired2 = await cache.acquireLock(lockKey, "worker-2", 10);
      expect(acquired2).toBe(false);

      // Lock should still be held by first worker
      const lockValue = await cache.get(lockKey);
      expect(lockValue).toBe("worker-1");

      // After first worker releases, second can acquire
      await cache.releaseLock(lockKey, "worker-1");
      const acquired3 = await cache.acquireLock(lockKey, "worker-2", 10);
      expect(acquired3).toBe(true);

      // Clean up
      await cache.releaseLock(lockKey, "worker-2");
    });

    it("should allow concurrent execution of different pipelines", async () => {
      const input = createTestInput();
      const config1 = createTestConfig({ reportId: `report-1-${Date.now()}` });
      const config2 = createTestConfig({ reportId: `report-2-${Date.now()}` });

      // Add delay to simulate concurrent execution
      vi.mocked(commentsToTree).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return success(mockClusteringResult);
      });

      const [result1, result2] = await Promise.all([
        runPipeline(input, config1, stateStore),
        runPipeline(input, config2, stateStore),
      ]);

      // Both should succeed since they have different reportIds
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Verify both have separate state in Redis
      const state1 = await stateStore.get(config1.reportId);
      const state2 = await stateStore.get(config2.reportId);

      expect(state1?.reportId).toBe(config1.reportId);
      expect(state2?.reportId).toBe(config2.reportId);
    });
  });

  describe("Lock Extension During Execution", () => {
    it("should extend lock during long-running operations", async () => {
      const reportId = `lock-extend-${Date.now()}`;
      const lockKey = `pipeline:lock:${reportId}`;
      const workerId = "test-worker";

      // Acquire lock
      const acquired = await cache.acquireLock(lockKey, workerId, 2);
      expect(acquired).toBe(true);

      // Wait 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Extend lock to 5 seconds
      const extended = await cache.extendLock(lockKey, workerId, 5);
      expect(extended).toBe(true);

      // Wait another 1.5 seconds (total 2.5s from initial acquisition)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Lock should still be held (because we extended it)
      const value = await cache.get(lockKey);
      expect(value).toBe(workerId);

      // Clean up
      await cache.releaseLock(lockKey, workerId);
    });

    it("should fail to extend lock with wrong worker ID", async () => {
      const reportId = `lock-extend-wrong-${Date.now()}`;
      const lockKey = `pipeline:lock:${reportId}`;

      await cache.acquireLock(lockKey, "worker-1", 10);

      // Try to extend with wrong worker ID
      const extended = await cache.extendLock(lockKey, "worker-2", 10);
      expect(extended).toBe(false);

      await cache.releaseLock(lockKey, "worker-1");
    });
  });

  describe("Lock TTL Expiration", () => {
    it("should automatically release lock after TTL expires", async () => {
      const reportId = `lock-ttl-${Date.now()}`;
      const lockKey = `pipeline:lock:${reportId}`;

      // Acquire lock with 1 second TTL
      await cache.acquireLock(lockKey, "worker-1", 1);

      // Verify lock exists
      let value = await cache.get(lockKey);
      expect(value).toBe("worker-1");

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Lock should be expired
      value = await cache.get(lockKey);
      expect(value).toBeNull();

      // Another worker should be able to acquire the lock
      const acquired = await cache.acquireLock(lockKey, "worker-2", 10);
      expect(acquired).toBe(true);

      await cache.releaseLock(lockKey, "worker-2");
    });

    it("should handle lock expiration during pipeline execution", async () => {
      const reportId = `lock-expire-during-${Date.now()}`;
      const input = createTestInput();
      const config = createTestConfig({ reportId });

      // Simulate a scenario where lock might expire during execution
      // by using a very short initial lock time
      const lockKey = `pipeline:lock:${reportId}`;
      await cache.acquireLock(lockKey, "external-worker", 1);

      // Wait for lock to expire
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Now pipeline should be able to acquire the lock
      const result = await runPipeline(input, config, stateStore);

      // Should succeed because lock expired
      expect(result.success).toBe(true);
    });

    it("should fail pipeline when lock expires mid-execution before state save", async () => {
      const reportId = `lock-expire-mid-execution-${Date.now()}`;
      const input = createTestInput();
      const lockValue = `test-worker-${Date.now()}`;
      const config = createTestConfig({ reportId, lockValue });
      const lockKey = `pipeline_lock:${reportId}`;

      // Pre-acquire lock with the same lockValue that the pipeline will use
      const acquired = await cache.acquireLock(lockKey, lockValue, 10);
      expect(acquired).toBe(true);

      // Mock clustering to succeed, but delete the lock during execution
      // to simulate it expiring mid-execution
      let clusteringCallCount = 0;
      vi.mocked(commentsToTree).mockImplementation(async () => {
        clusteringCallCount++;
        // After step executes, delete the lock to simulate expiration
        // This will cause the next verifyLockBeforeSave to fail
        await new Promise((resolve) => setTimeout(resolve, 10));
        await cache.delete(lockKey);
        return success(mockClusteringResult);
      });

      // Run pipeline - should throw or return error when verifyLockBeforeSave detects lost lock
      // The lock gets deleted during clustering execution, causing the next save to fail
      try {
        const result = await runPipeline(input, config, stateStore);
        // If it returns a result, verify it's a failure with the correct error (new atomic save message)
        expect(result.success).toBe(false);
        expect(result.error?.message).toContain(
          "Pipeline lock lost during save - cannot safely persist state",
        );
      } catch (error) {
        // If it throws, verify it's the correct error (new atomic save message)
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(
          "Pipeline lock lost during save - cannot safely persist state",
        );
      }

      // Verify the clustering step was actually called
      expect(clusteringCallCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("State Serialization with Real Redis", () => {
    it("should handle complex nested structures through JSON roundtrip", async () => {
      const reportId = `serialization-${Date.now()}`;
      const input = createTestInput();
      const config = createTestConfig({ reportId });

      const result = await runPipeline(input, config, stateStore);
      expect(result.success).toBe(true);

      // Retrieve state from Redis
      const state = await stateStore.get(reportId);
      expect(state).toBeDefined();

      // Verify complex nested structures are preserved
      expect(state?.completedResults.clustering).toEqual(mockClusteringResult);
      expect(state?.completedResults.claims).toEqual(mockClaimsResult);
      expect(state?.completedResults.sort_and_deduplicate).toEqual(
        mockSortedResult,
      );
      expect(state?.completedResults.summaries).toEqual(mockSummariesResult);

      // Verify step analytics structure
      expect(state?.stepAnalytics.clustering.status).toBe("completed");
      expect(state?.stepAnalytics.clustering.durationMs).toBeGreaterThan(0);
      expect(state?.stepAnalytics.clustering.totalTokens).toBe(
        mockClusteringResult.usage.total_tokens,
      );
    });

    it("should preserve data types through serialization", async () => {
      const reportId = `data-types-${Date.now()}`;
      const input = createTestInput();
      const config = createTestConfig({ reportId });

      await runPipeline(input, config, stateStore);

      const state = await stateStore.get(reportId);
      expect(state).toBeDefined();

      // Verify number types
      expect(typeof state?.totalTokens).toBe("number");
      expect(typeof state?.totalCost).toBe("number");
      expect(typeof state?.totalDurationMs).toBe("number");

      // Verify string types
      expect(typeof state?.reportId).toBe("string");
      expect(typeof state?.userId).toBe("string");
      expect(typeof state?.status).toBe("string");

      // Verify timestamp fields are preserved
      expect(state?.createdAt).toBeDefined();
      expect(state?.updatedAt).toBeDefined();
    });

    it("should handle large state objects", async () => {
      const reportId = `large-state-${Date.now()}`;

      // Create large mock data
      const largeClaims = Array.from({ length: 100 }, (_, i) => ({
        claim: `Claim number ${i}`,
        quote: `Quote for claim ${i}`,
        speaker: `Speaker ${i}`,
        topicName: "Technology",
        subtopicName: "AI",
        commentId: `c${i}`,
      }));

      const largeMockClaimsResult = {
        data: {
          Technology: {
            total: 100,
            subtopics: {
              AI: {
                total: 100,
                claims: largeClaims,
              },
            },
          },
        },
        usage: {
          input_tokens: 10000,
          output_tokens: 5000,
          total_tokens: 15000,
        },
        cost: 0.1,
      };

      vi.mocked(extractClaims).mockResolvedValue(
        success(largeMockClaimsResult),
      );

      const input = createTestInput();
      const config = createTestConfig({ reportId });

      const result = await runPipeline(input, config, stateStore);
      expect(result.success).toBe(true);

      // Verify large state was persisted correctly
      const state = await stateStore.get(reportId);
      expect(state?.completedResults.claims).toEqual(largeMockClaimsResult);
      expect(
        state?.completedResults.claims?.data.Technology.subtopics.AI.claims,
      ).toHaveLength(100);
    });
  });

  describe("Validation Failure Counter", () => {
    it("should atomically increment validation failure counter", async () => {
      const reportId = `validation-counter-${Date.now()}`;
      const stepName = "claims";

      // Increment counter multiple times
      const count1 = await stateStore.incrementValidationFailure(
        reportId,
        stepName,
      );
      expect(count1).toBe(1);

      const count2 = await stateStore.incrementValidationFailure(
        reportId,
        stepName,
      );
      expect(count2).toBe(2);

      const count3 = await stateStore.incrementValidationFailure(
        reportId,
        stepName,
      );
      expect(count3).toBe(3);

      // Verify counter persists in Redis
      const counterKey = `pipeline_validation_failure:${reportId}:${stepName}`;
      const storedValue = await cache.get(counterKey);
      expect(storedValue).toBe("3");
    });

    it("should prevent infinite loops after MAX_VALIDATION_FAILURES", async () => {
      const reportId = `validation-max-${Date.now()}`;

      // Simulate corrupted state that keeps failing validation
      vi.mocked(extractClaims).mockResolvedValue(
        failure(new Error("Validation failed")),
      );

      const input = createTestInput();
      const config = createTestConfig({ reportId });

      const result = await runPipeline(input, config, stateStore);

      // Should fail after first attempt (since MAX_VALIDATION_FAILURES is checked)
      expect(result.success).toBe(false);
      expect(result.state.error?.step).toBe("claims");
    });

    it("should fail permanently after MAX_VALIDATION_FAILURES with corrupted state", async () => {
      const reportId = `validation-max-corrupted-${Date.now()}`;

      // Create state with completed clustering step
      const input = createTestInput();
      const initialConfig = createTestConfig({ reportId });

      // First run succeeds
      const firstResult = await runPipeline(input, initialConfig, stateStore);
      expect(firstResult.success).toBe(true);

      // Manually corrupt the clustering result in Redis to trigger validation failures
      const state = await stateStore.get(reportId);
      if (state) {
        state.status = "failed";
        state.stepAnalytics.claims.status = "failed";
        state.completedResults.clustering = {
          data: mockClusteringResult.data,
          usage: mockClusteringResult.usage,
          // Missing 'cost' field - will fail validation
        } as typeof mockClusteringResult;

        // Set validation counter to 2 (one below the limit)
        await stateStore.save(state);
        await cache.set(
          `pipeline_validation_failure:${reportId}:clustering`,
          "2",
        );
      }

      // Try to resume - should fail permanently after incrementing to 3
      const resumeConfig = createTestConfig({
        reportId,
        resumeFromState: true,
      });

      const result = await runPipeline(input, resumeConfig, stateStore);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("validation failed 3 times");
      expect(result.error?.message).toContain("permanently corrupted");
    });
  });

  describe("Crash Recovery Simulation", () => {
    it("should preserve state when operation is interrupted", async () => {
      const reportId = `crash-recovery-${Date.now()}`;
      const input = createTestInput();
      const config = createTestConfig({ reportId });

      // First run: complete clustering, then fail
      vi.mocked(extractClaims).mockResolvedValue(
        failure(new Error("Simulated crash during claims")),
      );

      const firstResult = await runPipeline(input, config, stateStore);
      expect(firstResult.success).toBe(false);

      // Verify state was persisted despite failure
      const intermediateState = await stateStore.get(reportId);
      expect(intermediateState).toBeDefined();
      expect(intermediateState?.completedResults.clustering).toEqual(
        mockClusteringResult,
      );
      expect(intermediateState?.stepAnalytics.clustering.status).toBe(
        "completed",
      );
      expect(intermediateState?.stepAnalytics.claims.status).toBe("failed");

      // Second run: resume from persisted state
      vi.mocked(extractClaims).mockResolvedValue(success(mockClaimsResult));

      const resumeConfig = createTestConfig({
        reportId,
        resumeFromState: true,
      });
      const secondResult = await runPipeline(input, resumeConfig, stateStore);

      expect(secondResult.success).toBe(true);
      expect(secondResult.state.status).toBe("completed");

      // Verify clustering was not re-executed
      expect(commentsToTree).toHaveBeenCalledTimes(1);
    });

    it("should prevent concurrent resume attempts of same failed pipeline", async () => {
      const reportId = `concurrent-resume-${Date.now()}`;
      const input = createTestInput();
      const initialConfig = createTestConfig({ reportId });

      // First run: complete clustering, then fail
      vi.mocked(extractClaims).mockResolvedValue(
        failure(new Error("Simulated crash during claims")),
      );

      const firstResult = await runPipeline(input, initialConfig, stateStore);
      expect(firstResult.success).toBe(false);

      // Verify state was persisted with failed claims step
      const intermediateState = await stateStore.get(reportId);
      expect(intermediateState?.completedResults.clustering).toEqual(
        mockClusteringResult,
      );
      expect(intermediateState?.stepAnalytics.claims.status).toBe("failed");

      // Reset mocks and fix the claims step for resume
      vi.clearAllMocks();
      vi.mocked(commentsToTree).mockResolvedValue(
        success(mockClusteringResult),
      );
      vi.mocked(extractClaims).mockResolvedValue(success(mockClaimsResult));
      vi.mocked(sortAndDeduplicateClaims).mockResolvedValue(
        success(mockSortedResult),
      );
      vi.mocked(generateTopicSummaries).mockResolvedValue(
        success(mockSummariesResult),
      );

      // Simulate two workers trying to resume concurrently
      // Each worker attempts to acquire lock before running pipeline (like handler.ts does)
      const worker1LockValue = `worker-1-${Date.now()}`;
      const worker2LockValue = `worker-2-${Date.now()}`;

      // Worker simulation function that mimics handler.ts behavior
      const simulateWorker = async (
        lockValue: string,
      ): Promise<{
        lockAcquired: boolean;
        result?: Awaited<ReturnType<typeof runPipeline>>;
      }> => {
        const lockAcquired = await stateStore.acquirePipelineLock(
          reportId,
          lockValue,
        );

        if (!lockAcquired) {
          return { lockAcquired: false };
        }

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

      // Run both workers concurrently
      const [worker1, worker2] = await Promise.all([
        simulateWorker(worker1LockValue),
        simulateWorker(worker2LockValue),
      ]);

      // Only one worker should have acquired the lock
      const lockAcquisitions = [worker1, worker2].filter(
        (w) => w.lockAcquired,
      ).length;
      expect(lockAcquisitions).toBe(1);

      // The worker that acquired the lock should have completed successfully
      const successfulWorker = [worker1, worker2].find((w) => w.lockAcquired);
      expect(successfulWorker).toBeDefined();
      expect(successfulWorker?.result?.success).toBe(true);

      // The other worker should not have run the pipeline
      const blockedWorker = [worker1, worker2].find((w) => !w.lockAcquired);
      expect(blockedWorker?.result).toBeUndefined();

      // Verify final state shows completion
      const finalState = await stateStore.get(reportId);
      expect(finalState?.status).toBe("completed");

      // Verify clustering was not re-executed (already completed in first run)
      expect(commentsToTree).not.toHaveBeenCalled();
    });

    it("should handle Redis connection loss gracefully", async () => {
      const reportId = `redis-disconnect-${Date.now()}`;

      // Create a separate cache instance for this test
      const testCache = new RedisCache({
        provider: "redis",
        host: redisContainer.getHost(),
        port: redisContainer.getPort(),
      });
      const testStateStore = new RedisPipelineStateStore(testCache);

      const input = createTestInput();
      const config = createTestConfig({ reportId });

      // Start pipeline execution
      const pipelinePromise = runPipeline(input, config, testStateStore);

      // Disconnect Redis during execution
      if (
        "disconnect" in testCache &&
        typeof testCache.disconnect === "function"
      ) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        await testCache.disconnect();
      }

      // Pipeline should handle the disconnection
      const result = await pipelinePromise;

      // Result depends on when disconnection happened
      // Either it completed before disconnect, or failed gracefully
      expect(result.state.reportId).toBe(reportId);
    });
  });
});
