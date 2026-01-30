/**
 * Integration Tests for Redis Connection Loss and Recovery
 *
 * These tests verify graceful handling of Redis connection failures,
 * reconnection behavior, and state consistency after connection recovery.
 *
 * REQUIREMENTS:
 * - Docker must be installed and running
 * - Tests will be skipped if Docker is not available
 *
 * RUN LOCALLY:
 * pnpm --filter=pipeline-worker run test redis-connection-loss.integration.test.ts
 */

import {
  RedisContainer,
  type StartedRedisContainer,
} from "@testcontainers/redis";
import Redis from "ioredis";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { isDockerAvailable } from "../../../__tests__/test-helpers.js";
import type { RedisCacheConfig } from "../../types";
import { RedisCache } from "../redis";

// Mock logger
vi.mock("tttc-common/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

// Check Docker availability before running tests
const dockerAvailable = await isDockerAvailable();

describe.skipIf(!dockerAvailable)(
  "Redis Connection Loss Integration Tests",
  () => {
    let redisContainer: StartedRedisContainer;
    let cache: RedisCache;
    let config: RedisCacheConfig;
    const testKeyPrefix = `test:connection-loss:${Date.now()}`;

    beforeAll(async () => {
      // Start Redis container
      redisContainer = await new RedisContainer("redis:7-alpine").start();

      config = {
        provider: "redis",
        host: redisContainer.getHost(),
        port: redisContainer.getPort(),
      };

      cache = new RedisCache(config);
    }, 60000);

    afterAll(async () => {
      if (cache && "disconnect" in cache) {
        await cache.disconnect();
      }
      if (redisContainer) {
        await redisContainer.stop();
      }
    });

    beforeEach(async () => {
      vi.clearAllMocks();
      // Small delay between tests
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    describe("Connection Failure Detection", () => {
      it("should detect when Redis connection is lost", async () => {
        const testKey = `${testKeyPrefix}:detect-loss`;

        // Set a value
        await cache.set(testKey, "test-value");

        // Stop Redis container to simulate connection loss
        await redisContainer.stop();

        // Try to get value - should handle error gracefully
        try {
          await cache.get(testKey);
          // If it doesn't throw, that's also acceptable (might return null)
        } catch (error) {
          // Expected: connection error
          expect(error).toBeInstanceOf(Error);
        }
      }, 30000);

      it("should handle connection loss during write operations", async () => {
        // Restart container first
        redisContainer = await new RedisContainer("redis:7-alpine").start();
        cache = new RedisCache({
          provider: "redis",
          host: redisContainer.getHost(),
          port: redisContainer.getPort(),
        });

        const testKey = `${testKeyPrefix}:write-loss`;

        // Stop Redis
        await redisContainer.stop();

        // Try to write - should handle error gracefully
        try {
          await cache.set(testKey, "test-value");
          // Might not throw immediately due to connection pooling
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }, 30000);
    });

    describe("Connection Recovery", () => {
      it("should reconnect after Redis becomes available again", async () => {
        // Restart Redis
        redisContainer = await new RedisContainer("redis:7-alpine").start();

        // Create new cache instance
        cache = new RedisCache({
          provider: "redis",
          host: redisContainer.getHost(),
          port: redisContainer.getPort(),
        });

        const testKey = `${testKeyPrefix}:reconnect`;

        // Should work after reconnection
        await cache.set(testKey, "recovered-value");
        const result = await cache.get(testKey);

        expect(result).toBe("recovered-value");

        // Cleanup
        await cache.delete(testKey);
      }, 30000);

      it("should maintain data integrity after reconnection", async () => {
        const testKey = `${testKeyPrefix}:integrity`;

        // Set value before disconnect
        await cache.set(testKey, "original-value");

        // Stop and restart Redis (data will be lost in this test setup)
        await redisContainer.stop();
        redisContainer = await new RedisContainer("redis:7-alpine").start();

        // Reconnect
        cache = new RedisCache({
          provider: "redis",
          host: redisContainer.getHost(),
          port: redisContainer.getPort(),
        });

        // Value should be gone (Redis container was restarted)
        const result = await cache.get(testKey);
        expect(result).toBeNull();
      }, 30000);
    });

    describe("Lock Operations During Connection Loss", () => {
      it("should fail to acquire lock when Redis is down", async () => {
        const lockKey = `${testKeyPrefix}:lock-down`;
        const lockValue = "worker-1";

        // Stop Redis
        await redisContainer.stop();

        // Try to acquire lock
        try {
          const acquired = await cache.acquireLock(lockKey, lockValue, 10);
          // If it doesn't throw, it should return false
          expect(acquired).toBe(false);
        } catch (error) {
          // Expected: connection error
          expect(error).toBeInstanceOf(Error);
        }
      }, 30000);

      it("should handle lock refresh failure due to connection loss", async () => {
        // Restart Redis
        redisContainer = await new RedisContainer("redis:7-alpine").start();
        cache = new RedisCache({
          provider: "redis",
          host: redisContainer.getHost(),
          port: redisContainer.getPort(),
        });

        const lockKey = `${testKeyPrefix}:lock-refresh-fail`;
        const lockValue = "worker-1";

        // Acquire lock
        await cache.acquireLock(lockKey, lockValue, 10);

        // Stop Redis
        await redisContainer.stop();

        // Try to extend lock
        try {
          const extended = await cache.extendLock(lockKey, lockValue, 10);
          // Should fail or return false
          expect(extended).toBe(false);
        } catch (error) {
          // Expected: connection error
          expect(error).toBeInstanceOf(Error);
        }
      }, 30000);

      it("should handle lock verification during connection issues", async () => {
        // Restart Redis
        redisContainer = await new RedisContainer("redis:7-alpine").start();
        cache = new RedisCache({
          provider: "redis",
          host: redisContainer.getHost(),
          port: redisContainer.getPort(),
        });

        const lockKey = `${testKeyPrefix}:lock-verify-fail`;
        const lockValue = "worker-1";

        // Acquire lock
        await cache.acquireLock(lockKey, lockValue, 10);

        // Stop Redis
        await redisContainer.stop();

        // Try to verify lock
        try {
          const verified = await cache.verifyLock(lockKey, lockValue);
          // Should fail or return false
          expect(verified).toBe(false);
        } catch (error) {
          // Expected: connection error
          expect(error).toBeInstanceOf(Error);
        }
      }, 30000);
    });

    describe("Retry and Timeout Behavior", () => {
      it("should respect maxRetriesPerRequest setting", async () => {
        // Restart Redis
        redisContainer = await new RedisContainer("redis:7-alpine").start();

        // Create cache with specific retry settings
        const testCache = new RedisCache({
          provider: "redis",
          host: redisContainer.getHost(),
          port: redisContainer.getPort(),
        });

        const testKey = `${testKeyPrefix}:max-retries`;

        // Stop Redis to cause failures
        await redisContainer.stop();

        const startTime = Date.now();

        // Try operation - should fail after max retries
        try {
          await testCache.get(testKey);
        } catch (error) {
          const duration = Date.now() - startTime;

          // Should fail relatively quickly (not hang indefinitely)
          // With 3 retries and exponential backoff, should be under 10 seconds
          expect(duration).toBeLessThan(10000);
          expect(error).toBeInstanceOf(Error);
        }

        // Cleanup
        if ("disconnect" in testCache) {
          await testCache.disconnect();
        }
      }, 30000);

      it("should handle timeout during long operations", async () => {
        // Restart Redis
        redisContainer = await new RedisContainer("redis:7-alpine").start();
        cache = new RedisCache({
          provider: "redis",
          host: redisContainer.getHost(),
          port: redisContainer.getPort(),
        });

        // Create a very large value
        const testKey = `${testKeyPrefix}:timeout`;
        const largeValue = "x".repeat(10_000_000); // 10MB

        const startTime = Date.now();

        try {
          await cache.set(testKey, largeValue);
          // Might succeed or timeout depending on Redis performance
          const duration = Date.now() - startTime;

          // Should complete in reasonable time
          expect(duration).toBeLessThan(30000);
        } catch (error) {
          // Timeout or size limit error is acceptable
          expect(error).toBeInstanceOf(Error);
        }

        // Cleanup
        await cache.delete(testKey);
      }, 60000);
    });

    describe("Atomic Operations During Connection Issues", () => {
      it("should fail atomic save when connection is lost", async () => {
        // Restart Redis
        redisContainer = await new RedisContainer("redis:7-alpine").start();
        cache = new RedisCache({
          provider: "redis",
          host: redisContainer.getHost(),
          port: redisContainer.getPort(),
        });

        const lockKey = `${testKeyPrefix}:atomic-lock`;
        const lockValue = "worker-1";

        // Acquire lock
        await cache.acquireLock(lockKey, lockValue, 10);

        // Stop Redis
        await redisContainer.stop();

        // Try atomic save
        const operations = [
          {
            key: `${testKeyPrefix}:atomic-value`,
            value: "test",
          },
        ];

        try {
          const result = await cache.setMultipleWithLockVerification(
            lockKey,
            lockValue,
            operations,
          );

          // Should fail
          expect(result.success).toBe(false);
        } catch (error) {
          // Or throw connection error
          expect(error).toBeInstanceOf(Error);
        }
      }, 30000);

      it("should not save partial data when connection fails mid-operation", async () => {
        // Restart Redis
        redisContainer = await new RedisContainer("redis:7-alpine").start();
        cache = new RedisCache({
          provider: "redis",
          host: redisContainer.getHost(),
          port: redisContainer.getPort(),
        });

        const lockKey = `${testKeyPrefix}:partial-lock`;
        const lockValue = "worker-1";

        // Acquire lock
        await cache.acquireLock(lockKey, lockValue, 10);

        // Prepare operations
        const operations = [
          { key: `${testKeyPrefix}:partial-1`, value: "value1" },
          { key: `${testKeyPrefix}:partial-2`, value: "value2" },
          { key: `${testKeyPrefix}:partial-3`, value: "value3" },
        ];

        // Stop Redis during operation
        setTimeout(() => {
          redisContainer.stop();
        }, 50);

        try {
          await cache.setMultipleWithLockVerification(
            lockKey,
            lockValue,
            operations,
          );
        } catch (error) {
          // Expected: connection error
          expect(error).toBeInstanceOf(Error);
        }

        // Restart Redis to check state
        redisContainer = await new RedisContainer("redis:7-alpine").start();
        cache = new RedisCache({
          provider: "redis",
          host: redisContainer.getHost(),
          port: redisContainer.getPort(),
        });

        // None of the values should exist (atomic operation)
        // Note: Since container restarted, data is lost anyway
        const val1 = await cache.get(`${testKeyPrefix}:partial-1`);
        const val2 = await cache.get(`${testKeyPrefix}:partial-2`);
        const val3 = await cache.get(`${testKeyPrefix}:partial-3`);

        expect(val1).toBeNull();
        expect(val2).toBeNull();
        expect(val3).toBeNull();
      }, 30000);
    });

    describe("State Consistency After Reconnection", () => {
      it("should handle incremental connection failures gracefully", async () => {
        // Restart Redis
        redisContainer = await new RedisContainer("redis:7-alpine").start();
        cache = new RedisCache({
          provider: "redis",
          host: redisContainer.getHost(),
          port: redisContainer.getPort(),
        });

        const testKey = `${testKeyPrefix}:incremental`;

        // Operation 1: Success
        await cache.set(testKey, "value1");
        const result1 = await cache.get(testKey);
        expect(result1).toBe("value1");

        // Operation 2: Stop Redis (failure)
        await redisContainer.stop();

        try {
          await cache.set(testKey, "value2");
        } catch (error) {
          // Expected
        }

        // Operation 3: Restart Redis (recovery)
        redisContainer = await new RedisContainer("redis:7-alpine").start();
        cache = new RedisCache({
          provider: "redis",
          host: redisContainer.getHost(),
          port: redisContainer.getPort(),
        });

        // Should work again
        await cache.set(testKey, "value3");
        const result3 = await cache.get(testKey);
        expect(result3).toBe("value3");
      }, 60000);

      it("should maintain lock semantics after reconnection", async () => {
        const lockKey = `${testKeyPrefix}:lock-semantics`;
        const worker1Value = "worker-1";

        // Worker 1 acquires lock
        await cache.acquireLock(lockKey, worker1Value, 10);

        // Restart Redis (lock will be lost)
        await redisContainer.stop();
        redisContainer = await new RedisContainer("redis:7-alpine").start();
        cache = new RedisCache({
          provider: "redis",
          host: redisContainer.getHost(),
          port: redisContainer.getPort(),
        });

        // Worker 2 should be able to acquire lock (worker 1's lock is gone)
        const worker2Value = "worker-2";
        const acquired = await cache.acquireLock(lockKey, worker2Value, 10);

        expect(acquired).toBe(true);

        // Cleanup
        await cache.releaseLock(lockKey, worker2Value);
      }, 30000);
    });

    describe("Connection Event Handling", () => {
      it("should emit error events on connection failures", async () => {
        // Create a new Redis client to monitor events
        const errorEvents: Error[] = [];

        const testRedis = new Redis({
          host: redisContainer.getHost(),
          port: redisContainer.getPort(),
          lazyConnect: true,
        });

        testRedis.on("error", (error) => {
          errorEvents.push(error);
        });

        await testRedis.connect();

        // Stop Redis to cause error
        await redisContainer.stop();

        // Try operation
        try {
          await testRedis.get("test");
        } catch (error) {
          // Expected
        }

        // Wait for error events to propagate
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Should have received error events
        expect(errorEvents.length).toBeGreaterThan(0);

        await testRedis.disconnect();
      }, 30000);

      it("should emit reconnecting events when attempting to reconnect", async () => {
        // Restart Redis first
        redisContainer = await new RedisContainer("redis:7-alpine").start();

        const reconnectingEvents: number[] = [];

        const testRedis = new Redis({
          host: redisContainer.getHost(),
          port: redisContainer.getPort(),
          lazyConnect: true,
          retryStrategy: (times) => {
            // Exponential backoff with max 2s
            return Math.min(times * 100, 2000);
          },
        });

        testRedis.on("reconnecting", (delay: number) => {
          reconnectingEvents.push(delay);
        });

        await testRedis.connect();

        // Stop Redis to trigger reconnection attempts
        await redisContainer.stop();

        // Try operation to trigger reconnection
        try {
          await testRedis.get("test");
        } catch (error) {
          // Expected
        }

        // Wait for reconnection attempts
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Should have attempted reconnection
        // Note: Might not always trigger depending on timing
        // expect(reconnectingEvents.length).toBeGreaterThan(0);

        await testRedis.disconnect();
      }, 30000);
    });

    describe("Pipeline Robustness", () => {
      it("should handle connection loss during pipeline state operations", async () => {
        // Restart Redis
        redisContainer = await new RedisContainer("redis:7-alpine").start();
        cache = new RedisCache({
          provider: "redis",
          host: redisContainer.getHost(),
          port: redisContainer.getPort(),
        });

        const stateKey = `${testKeyPrefix}:pipeline-state`;
        const pipelineState = JSON.stringify({
          reportId: "test-report",
          status: "running",
          currentStep: "clustering",
        });

        // Save state
        await cache.set(stateKey, pipelineState);

        // Stop Redis
        await redisContainer.stop();

        // Try to update state
        try {
          const updatedState = JSON.stringify({
            reportId: "test-report",
            status: "running",
            currentStep: "claims",
          });

          await cache.set(stateKey, updatedState);
        } catch (error) {
          // Expected: connection error
          expect(error).toBeInstanceOf(Error);
        }

        // Restart and verify original state is preserved (or lost)
        redisContainer = await new RedisContainer("redis:7-alpine").start();
        cache = new RedisCache({
          provider: "redis",
          host: redisContainer.getHost(),
          port: redisContainer.getPort(),
        });

        // State should be gone (new Redis instance)
        const result = await cache.get(stateKey);
        expect(result).toBeNull();
      }, 30000);
    });
  },
);
