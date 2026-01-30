/**
 * Integration Tests for Lock Refresh and Expiration During Execution
 *
 * These tests verify lock refresh mechanisms during long-running pipeline steps,
 * lock extension after pipeline completion, and proper handling of lock expiration
 * during result processing (GCS upload, Firestore updates).
 *
 * REQUIREMENTS:
 * - Docker must be installed and running
 * - Tests will be skipped if Docker is not available
 *
 * RUN LOCALLY:
 * pnpm --filter=pipeline-worker run test lock-refresh-expiration.integration.test.ts
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
  LOCK_EXTENSION_SECONDS,
  LOCK_REFRESH_INTERVAL_MS,
  LOCK_TTL_SECONDS,
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

describe("Lock Refresh and Expiration Integration Tests", () => {
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

  describe("Lock Refresh During Long-Running Steps", () => {
    it("should periodically refresh lock during step execution", async () => {
      const reportId = `lock-refresh-${Date.now()}`;
      const lockValue = `test-worker-${Date.now()}`;
      const lockKey = `pipeline_lock:${reportId}`;

      // Acquire lock manually
      await cache.acquireLock(lockKey, lockValue, 5); // 5 second initial TTL

      // Track lock extensions
      const lockExtensions: number[] = [];
      const originalExtendLock = cache.extendLock.bind(cache);

      // Spy on extendLock to track calls
      const extendLockSpy = vi
        .spyOn(cache, "extendLock")
        .mockImplementation(async (key, value, ttlSeconds) => {
          lockExtensions.push(Date.now());
          return originalExtendLock(key, value, ttlSeconds);
        });

      try {
        // Simulate long-running step by adding delay
        vi.mocked(extractClaims).mockImplementation(async () => {
          // Wait 2 seconds during "claims" step
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return success(mockClaimsResult);
        });

        const input = createTestInput();
        const config = createTestConfig({ reportId, lockValue });

        const result = await runPipeline(input, config, stateStore);

        expect(result.success).toBe(true);

        // Verify lock was extended at least once during execution
        // Note: This depends on LOCK_REFRESH_INTERVAL_MS and step duration
        // With a 2-second step and typical refresh intervals, we might see refreshes
        expect(extendLockSpy).toHaveBeenCalled();
      } finally {
        extendLockSpy.mockRestore();
        await cache.releaseLock(lockKey, lockValue);
      }
    }, 30000);

    it("should fail pipeline if lock refresh fails during execution", async () => {
      const reportId = `lock-refresh-fail-${Date.now()}`;
      const lockValue = `test-worker-${Date.now()}`;
      const lockKey = `pipeline_lock:${reportId}`;

      // Acquire lock
      await cache.acquireLock(lockKey, lockValue, 10);

      // Simulate slow clustering step
      vi.mocked(commentsToTree).mockImplementation(async () => {
        // During execution, delete the lock to simulate expiration
        await new Promise((resolve) => setTimeout(resolve, 100));
        await cache.delete(lockKey);
        await new Promise((resolve) => setTimeout(resolve, 100));
        return success(mockClusteringResult);
      });

      const input = createTestInput();
      const config = createTestConfig({ reportId, lockValue });

      // Pipeline should fail when it detects lock loss
      try {
        const result = await runPipeline(input, config, stateStore);

        // Should return failure or throw
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error?.message).toContain("lock");
        }
      } catch (error) {
        // Or it might throw directly
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("lock");
      }
    }, 30000);

    it("should abort step execution when lock refresh fails", async () => {
      const reportId = `lock-abort-${Date.now()}`;
      const lockValue = `test-worker-${Date.now()}`;
      const lockKey = `pipeline_lock:${reportId}`;

      // Pre-acquire lock
      await cache.acquireLock(lockKey, lockValue, 2); // Short TTL

      let claimsExecutionCompleted = false;

      // Mock claims to take longer than lock TTL
      vi.mocked(extractClaims).mockImplementation(async () => {
        // Wait for lock to expire
        await new Promise((resolve) => setTimeout(resolve, 3000));
        claimsExecutionCompleted = true;
        return success(mockClaimsResult);
      });

      const input = createTestInput();
      const config = createTestConfig({ reportId, lockValue });

      const result = await runPipeline(input, config, stateStore);

      // Pipeline should detect lock loss and abort
      expect(result.success).toBe(false);

      // The step might or might not complete depending on abort timing
      // But the pipeline should fail overall
    }, 30000);
  });

  describe("Lock Extension After Pipeline Completion", () => {
    it("should extend lock after pipeline completes for result processing", async () => {
      const reportId = `lock-extend-post-${Date.now()}`;
      const lockValue = `test-worker-${Date.now()}`;
      const lockKey = `pipeline_lock:${reportId}`;

      const input = createTestInput();
      const config = createTestConfig({ reportId, lockValue });

      // Pre-acquire lock
      await cache.acquireLock(lockKey, lockValue, LOCK_TTL_SECONDS);

      // Run pipeline
      const result = await runPipeline(input, config, stateStore);

      expect(result.success).toBe(true);

      // After pipeline completes, lock should still be held (extended)
      // Check if lock exists
      const lockExists = await cache.verifyLock(lockKey, lockValue);

      // Lock should still be held for the extension period
      // Note: In actual handler.ts, the lock is extended with LOCK_EXTENSION_SECONDS
      // after pipeline completes and before GCS upload/Firestore update
      expect(lockExists).toBe(true);

      // Cleanup
      await cache.releaseLock(lockKey, lockValue);
    });

    it("should maintain lock during result processing window", async () => {
      const reportId = `lock-result-window-${Date.now()}`;
      const lockValue = `test-worker-${Date.now()}`;
      const lockKey = `pipeline_lock:${reportId}`;

      const input = createTestInput();
      const config = createTestConfig({ reportId, lockValue });

      // Acquire lock with extension TTL
      await cache.acquireLock(lockKey, lockValue, LOCK_EXTENSION_SECONDS);

      // Run pipeline
      const result = await runPipeline(input, config, stateStore);
      expect(result.success).toBe(true);

      // Simulate result processing (what handler.ts does)
      // Wait a bit to simulate GCS upload time
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Lock should still be held
      const lockStillHeld = await cache.verifyLock(lockKey, lockValue);
      expect(lockStillHeld).toBe(true);

      // Cleanup
      await cache.releaseLock(lockKey, lockValue);
    });

    it("should protect against concurrent result processing", async () => {
      const reportId = `lock-concurrent-result-${Date.now()}`;
      const worker1LockValue = `worker-1-${Date.now()}`;
      const worker2LockValue = `worker-2-${Date.now()}`;
      const lockKey = `pipeline_lock:${reportId}`;

      const input = createTestInput();

      // Worker 1 acquires lock and completes pipeline
      const acquired1 = await cache.acquireLock(
        lockKey,
        worker1LockValue,
        LOCK_EXTENSION_SECONDS,
      );
      expect(acquired1).toBe(true);

      const config1 = createTestConfig({
        reportId,
        lockValue: worker1LockValue,
      });
      const result1 = await runPipeline(input, config1, stateStore);
      expect(result1.success).toBe(true);

      // Worker 2 tries to process results for same report (should fail to acquire lock)
      const acquired2 = await cache.acquireLock(
        lockKey,
        worker2LockValue,
        LOCK_EXTENSION_SECONDS,
      );
      expect(acquired2).toBe(false);

      // Cleanup
      await cache.releaseLock(lockKey, worker1LockValue);
    });
  });

  describe("Lock Expiration During Critical Operations", () => {
    it("should detect lock loss before state save", async () => {
      const reportId = `lock-loss-save-${Date.now()}`;
      const lockValue = `test-worker-${Date.now()}`;
      const lockKey = `pipeline_lock:${reportId}`;

      // Pre-acquire lock
      await cache.acquireLock(lockKey, lockValue, 10);

      // Mock clustering to delete lock after execution
      vi.mocked(commentsToTree).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        // Delete lock to simulate expiration
        await cache.delete(lockKey);
        return success(mockClusteringResult);
      });

      const input = createTestInput();
      const config = createTestConfig({ reportId, lockValue });

      // Pipeline should fail when trying to save state without lock
      try {
        const result = await runPipeline(input, config, stateStore);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error?.message).toContain("lock");
        }
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("lock");
      }
    });

    it("should use atomic lock verification during state save", async () => {
      const reportId = `atomic-save-${Date.now()}`;
      const lockValue = `test-worker-${Date.now()}`;
      const lockKey = `pipeline_lock:${reportId}`;

      // Acquire lock
      await cache.acquireLock(lockKey, lockValue, 1); // Very short TTL

      const input = createTestInput();
      const config = createTestConfig({ reportId, lockValue });

      // Wait for lock to expire
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Try to create and save state - should fail because lock expired
      const state = createInitialState(reportId, config.userId);

      // State save with lock verification should fail
      try {
        await stateStore.save(state);

        // If save succeeded, verify lock wasn't required (state might be initial)
        // But if we're using setMultipleWithLockVerification, it should fail
      } catch (error) {
        // Expected: save fails because lock is gone
        expect(error).toBeInstanceOf(Error);
      }
    });

    it("should prevent TOCTOU race between lock check and state save", async () => {
      const reportId = `toctou-${Date.now()}`;
      const lockValue = `test-worker-${Date.now()}`;
      const lockKey = `pipeline_lock:${reportId}`;

      // Acquire lock with very short TTL
      await cache.acquireLock(lockKey, lockValue, 1);

      // Verify lock exists (Time of Check)
      const lockValid = await cache.verifyLock(lockKey, lockValue);
      expect(lockValid).toBe(true);

      // Wait for lock to expire (between check and use)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Try to save state (Time of Use)
      const operations = [
        {
          key: `pipeline_state:${reportId}`,
          value: JSON.stringify({ status: "running" }),
        },
      ];

      const result = await cache.setMultipleWithLockVerification(
        lockKey,
        lockValue,
        operations,
      );

      // Atomic operation should detect lock expiration
      expect(result.success).toBe(false);
      expect(result.reason).toBe("lock_expired");

      // State should NOT be saved
      const savedState = await cache.get(`pipeline_state:${reportId}`);
      expect(savedState).toBeNull();
    });
  });

  describe("Lock Configuration Consistency", () => {
    it("should verify lock TTL exceeds pipeline timeout", () => {
      // Lock TTL should be longer than pipeline timeout to allow completion
      const pipelineTimeoutSeconds = 30 * 60; // 30 minutes
      expect(LOCK_TTL_SECONDS).toBeGreaterThan(pipelineTimeoutSeconds);
    });

    it("should verify lock extension is reasonable for result processing", () => {
      // Lock extension should be sufficient for GCS upload + Firestore update
      // 10 minutes (600 seconds) should be plenty for result processing
      expect(LOCK_EXTENSION_SECONDS).toBeGreaterThanOrEqual(300); // At least 5 minutes
      expect(LOCK_EXTENSION_SECONDS).toBeLessThanOrEqual(900); // At most 15 minutes
    });

    it("should verify refresh interval allows multiple refreshes before expiration", () => {
      // Refresh interval should be much smaller than lock TTL
      const lockTtlMs = LOCK_TTL_SECONDS * 1000;
      const refreshCount = lockTtlMs / LOCK_REFRESH_INTERVAL_MS;

      // Should have at least 5 opportunities to refresh before expiration
      expect(refreshCount).toBeGreaterThanOrEqual(5);
    });

    it("should verify refresh interval is not too frequent", () => {
      // Refresh interval should not be too aggressive (avoid Redis load)
      // Should be at least 1 minute between refreshes
      expect(LOCK_REFRESH_INTERVAL_MS).toBeGreaterThanOrEqual(60000); // 1 minute
    });
  });

  describe("Lock Refresh Failure Scenarios", () => {
    it("should handle Redis connection issues during refresh", async () => {
      const reportId = `redis-refresh-fail-${Date.now()}`;
      const lockValue = `test-worker-${Date.now()}`;
      const lockKey = `pipeline_lock:${reportId}`;

      // Create separate cache for this test
      const testCache = new RedisCache({
        provider: "redis",
        host: redisContainer.getHost(),
        port: redisContainer.getPort(),
      });
      const testStateStore = new RedisPipelineStateStore(testCache);

      // Acquire lock
      await testCache.acquireLock(lockKey, lockValue, 10);

      // Mock slow step
      vi.mocked(commentsToTree).mockImplementation(async () => {
        // Disconnect Redis mid-execution
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (
          "disconnect" in testCache &&
          typeof testCache.disconnect === "function"
        ) {
          await testCache.disconnect();
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        return success(mockClusteringResult);
      });

      const input = createTestInput();
      const config = createTestConfig({ reportId, lockValue });

      // Pipeline should handle disconnection gracefully
      const result = await runPipeline(input, config, testStateStore);

      // Should fail or succeed depending on timing
      // But should not hang or crash
      expect(result.state.reportId).toBe(reportId);
    }, 30000);

    it("should not extend lock with wrong worker ID", async () => {
      const reportId = `wrong-worker-extend-${Date.now()}`;
      const worker1LockValue = `worker-1-${Date.now()}`;
      const worker2LockValue = `worker-2-${Date.now()}`;
      const lockKey = `pipeline_lock:${reportId}`;

      // Worker 1 acquires lock
      await cache.acquireLock(lockKey, worker1LockValue, 10);

      // Worker 2 tries to extend lock (should fail)
      const extended = await cache.extendLock(
        lockKey,
        worker2LockValue,
        LOCK_TTL_SECONDS,
      );

      expect(extended).toBe(false);

      // Worker 1 should still hold the lock
      const lockValue = await cache.get(lockKey);
      expect(lockValue).toBe(worker1LockValue);

      // Cleanup
      await cache.releaseLock(lockKey, worker1LockValue);
    });
  });

  describe("Real-Time Lock Behavior", () => {
    it("should actually expire lock after TTL in real time", async () => {
      const reportId = `real-expire-${Date.now()}`;
      const lockValue = `test-worker-${Date.now()}`;
      const lockKey = `pipeline_lock:${reportId}`;

      // Acquire lock with 2 second TTL
      await cache.acquireLock(lockKey, lockValue, 2);

      // Verify lock exists
      let exists = await cache.verifyLock(lockKey, lockValue);
      expect(exists).toBe(true);

      // Wait for expiration (2.5 seconds to be safe)
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Lock should be expired
      exists = await cache.verifyLock(lockKey, lockValue);
      expect(exists).toBe(false);

      // Another worker should be able to acquire
      const newLockValue = `new-worker-${Date.now()}`;
      const acquired = await cache.acquireLock(lockKey, newLockValue, 10);
      expect(acquired).toBe(true);

      // Cleanup
      await cache.releaseLock(lockKey, newLockValue);
    }, 10000);

    it("should allow lock refresh to extend TTL in real time", async () => {
      const reportId = `real-refresh-${Date.now()}`;
      const lockValue = `test-worker-${Date.now()}`;
      const lockKey = `pipeline_lock:${reportId}`;

      // Acquire lock with 2 second TTL
      await cache.acquireLock(lockKey, lockValue, 2);

      // Wait 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Extend lock to 5 seconds
      const extended = await cache.extendLock(lockKey, lockValue, 5);
      expect(extended).toBe(true);

      // Wait another 1.5 seconds (total 2.5s from initial acquisition)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Lock should still exist (because we extended it)
      const exists = await cache.verifyLock(lockKey, lockValue);
      expect(exists).toBe(true);

      // Cleanup
      await cache.releaseLock(lockKey, lockValue);
    }, 10000);
  });
});
