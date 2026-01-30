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
import type { RedisCacheConfig } from "../../types";
import { RedisCache } from "../redis";

// Mock logger to avoid pino dependency issues in tests
vi.mock("common/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

/**
 * Helper function to check if Redis is available for testing.
 * Attempts to connect to Redis and returns true if successful.
 */
async function isRedisAvailable(): Promise<boolean> {
  try {
    const testRedis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      lazyConnect: true,
      connectTimeout: 2000, // 2 second timeout
    });
    await testRedis.connect();
    await testRedis.ping();
    await testRedis.disconnect();
    return true;
  } catch {
    return false;
  }
}

// Redis availability will be checked in beforeAll
let redisAvailable = false;

describe("Redis Integration Tests", () => {
  let cache: RedisCache;
  const testKeyPrefix = `test:cache:${Date.now()}`;

  const config: RedisCacheConfig = {
    provider: "redis",
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    db: parseInt(process.env.REDIS_TEST_DB || "0", 10),
  };

  beforeAll(async () => {
    // Check if Redis is available
    redisAvailable = await isRedisAvailable();

    if (!redisAvailable) {
      console.warn(
        "\n⚠️  Redis Integration Tests Skipped: Redis is not available at " +
          `${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6379"}\n` +
          "To run integration tests, ensure Redis is running and accessible.\n",
      );
      return;
    }

    cache = new RedisCache(config);
  });

  afterAll(async () => {
    if (!redisAvailable) {
      return;
    }

    // Clean up all test keys
    const redis = new Redis({
      host: config.host,
      port: config.port,
      db: config.db,
    });

    try {
      const keys = await redis.keys(`${testKeyPrefix}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      await redis.disconnect();
      await cache.disconnect();
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    if (!redisAvailable) {
      return;
    }
    // Small delay between tests to avoid connection issues
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  describe("Connection", () => {
    it("should successfully connect to Redis", async () => {
      if (!redisAvailable) return;

      const testKey = `${testKeyPrefix}:connection-test`;
      await cache.set(testKey, "test-value");
      const result = await cache.get(testKey);

      expect(result).toBe("test-value");

      await cache.delete(testKey);
    });
  });

  describe("Basic Operations", () => {
    it("should set and get a value", async () => {
      if (!redisAvailable) return;

      const testKey = `${testKeyPrefix}:basic-set-get`;
      const testValue = "test-value";

      await cache.set(testKey, testValue);
      const result = await cache.get(testKey);

      expect(result).toBe(testValue);

      await cache.delete(testKey);
    });

    it("should return null for non-existent key", async () => {
      if (!redisAvailable) return;

      const testKey = `${testKeyPrefix}:non-existent`;
      const result = await cache.get(testKey);

      expect(result).toBeNull();
    });

    it("should delete a key", async () => {
      if (!redisAvailable) return;

      const testKey = `${testKeyPrefix}:delete-test`;

      await cache.set(testKey, "value-to-delete");
      let result = await cache.get(testKey);
      expect(result).toBe("value-to-delete");

      await cache.delete(testKey);
      result = await cache.get(testKey);
      expect(result).toBeNull();
    });

    it("should handle deleting non-existent key without error", async () => {
      if (!redisAvailable) return;

      const testKey = `${testKeyPrefix}:non-existent-delete`;

      await expect(cache.delete(testKey)).resolves.not.toThrow();
    });
  });

  describe("TTL Operations", () => {
    it("should set value with TTL and expire after specified time", async () => {
      if (!redisAvailable) return;

      const testKey = `${testKeyPrefix}:ttl-test`;
      const testValue = "value-with-ttl";

      await cache.set(testKey, testValue, { ttl: 1 });

      // Value should exist immediately
      let result = await cache.get(testKey);
      expect(result).toBe(testValue);

      // Wait for expiration (1 second + buffer)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Value should be expired
      result = await cache.get(testKey);
      expect(result).toBeNull();
    });

    it("should persist value when no TTL is specified", async () => {
      if (!redisAvailable) return;

      const testKey = `${testKeyPrefix}:no-ttl`;
      const testValue = "persistent-value";

      await cache.set(testKey, testValue);

      // Wait to ensure it doesn't expire
      await new Promise((resolve) => setTimeout(resolve, 500));

      const result = await cache.get(testKey);
      expect(result).toBe(testValue);

      await cache.delete(testKey);
    });

    it("should handle very short TTL (1 second)", async () => {
      if (!redisAvailable) return;

      const testKey = `${testKeyPrefix}:ttl-short`;
      const testValue = "short-ttl-value";

      await cache.set(testKey, testValue, { ttl: 1 });

      // Value should exist immediately
      let result = await cache.get(testKey);
      expect(result).toBe(testValue);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Value should be expired
      result = await cache.get(testKey);
      expect(result).toBeNull();
    });
  });

  describe("Data Types", () => {
    it("should handle empty string values", async () => {
      if (!redisAvailable) return;

      const testKey = `${testKeyPrefix}:empty-string`;

      await cache.set(testKey, "");
      const result = await cache.get(testKey);

      expect(result).toBe("");

      await cache.delete(testKey);
    });

    it("should handle JSON string values", async () => {
      if (!redisAvailable) return;

      const testKey = `${testKeyPrefix}:json-value`;
      const jsonValue = JSON.stringify({
        foo: "bar",
        nested: { val: 123 },
        array: [1, 2, 3],
      });

      await cache.set(testKey, jsonValue);
      const result = await cache.get(testKey);

      expect(result).toBe(jsonValue);
      if (result !== null) {
        expect(JSON.parse(result)).toEqual({
          foo: "bar",
          nested: { val: 123 },
          array: [1, 2, 3],
        });
      }

      await cache.delete(testKey);
    });

    it("should handle large values", async () => {
      if (!redisAvailable) return;

      const testKey = `${testKeyPrefix}:large-value`;
      const largeValue = "x".repeat(10000); // 10KB

      await cache.set(testKey, largeValue);
      const result = await cache.get(testKey);

      expect(result).toBe(largeValue);
      expect(result?.length).toBe(10000);

      await cache.delete(testKey);
    });

    it("should handle unicode characters", async () => {
      if (!redisAvailable) return;

      const testKey = `${testKeyPrefix}:unicode`;
      const unicodeValue = "Hello 世界 🎉 émojis";

      await cache.set(testKey, unicodeValue);
      const result = await cache.get(testKey);

      expect(result).toBe(unicodeValue);

      await cache.delete(testKey);
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle multiple concurrent sets", async () => {
      if (!redisAvailable) return;

      const operations = Array.from({ length: 10 }, (_, i) =>
        cache.set(`${testKeyPrefix}:concurrent-${i}`, `value-${i}`),
      );

      await expect(Promise.all(operations)).resolves.not.toThrow();

      // Verify all values were set
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          cache.get(`${testKeyPrefix}:concurrent-${i}`),
        ),
      );

      results.forEach((result, i) => {
        expect(result).toBe(`value-${i}`);
      });

      // Cleanup
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          cache.delete(`${testKeyPrefix}:concurrent-${i}`),
        ),
      );
    });

    it("should handle mixed concurrent operations", async () => {
      if (!redisAvailable) return;

      const baseKey = `${testKeyPrefix}:mixed`;

      // Set initial values
      await Promise.all([
        cache.set(`${baseKey}:1`, "value-1"),
        cache.set(`${baseKey}:2`, "value-2"),
        cache.set(`${baseKey}:3`, "value-3"),
      ]);

      // Mix of operations
      await Promise.all([
        cache.get(`${baseKey}:1`),
        cache.set(`${baseKey}:4`, "value-4"),
        cache.delete(`${baseKey}:2`),
        cache.get(`${baseKey}:3`),
      ]);

      // Verify final state
      const results = await Promise.all([
        cache.get(`${baseKey}:1`),
        cache.get(`${baseKey}:2`),
        cache.get(`${baseKey}:3`),
        cache.get(`${baseKey}:4`),
      ]);

      expect(results[0]).toBe("value-1");
      expect(results[1]).toBeNull(); // deleted
      expect(results[2]).toBe("value-3");
      expect(results[3]).toBe("value-4");

      // Cleanup
      await Promise.all([
        cache.delete(`${baseKey}:1`),
        cache.delete(`${baseKey}:3`),
        cache.delete(`${baseKey}:4`),
      ]);
    });
  });

  describe("Overwrite Operations", () => {
    it("should overwrite existing value", async () => {
      if (!redisAvailable) return;

      const testKey = `${testKeyPrefix}:overwrite`;

      await cache.set(testKey, "original-value");
      let result = await cache.get(testKey);
      expect(result).toBe("original-value");

      await cache.set(testKey, "new-value");
      result = await cache.get(testKey);
      expect(result).toBe("new-value");

      await cache.delete(testKey);
    });

    it("should overwrite TTL when setting again", async () => {
      if (!redisAvailable) return;

      const testKey = `${testKeyPrefix}:overwrite-ttl`;

      // Set with 1 second TTL
      await cache.set(testKey, "value1", { ttl: 1 });

      // Wait 500ms
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Set again with 5 second TTL
      await cache.set(testKey, "value2", { ttl: 5 });

      // Wait another 1 second (total 1.5s from first set)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should still exist because we reset the TTL
      const result = await cache.get(testKey);
      expect(result).toBe("value2");

      await cache.delete(testKey);
    });
  });

  describe("Batch Operations", () => {
    it("should atomically set multiple keys", async () => {
      if (!redisAvailable) return;

      const operations = [
        {
          key: `${testKeyPrefix}:batch:1`,
          value: "value-1",
        },
        {
          key: `${testKeyPrefix}:batch:2`,
          value: "value-2",
        },
        {
          key: `${testKeyPrefix}:batch:3`,
          value: "value-3",
        },
      ];

      await cache.setMultiple(operations);

      const results = await Promise.all([
        cache.get(`${testKeyPrefix}:batch:1`),
        cache.get(`${testKeyPrefix}:batch:2`),
        cache.get(`${testKeyPrefix}:batch:3`),
      ]);

      expect(results[0]).toBe("value-1");
      expect(results[1]).toBe("value-2");
      expect(results[2]).toBe("value-3");

      await Promise.all([
        cache.delete(`${testKeyPrefix}:batch:1`),
        cache.delete(`${testKeyPrefix}:batch:2`),
        cache.delete(`${testKeyPrefix}:batch:3`),
      ]);
    });

    it("should handle batch operations with TTL", async () => {
      if (!redisAvailable) return;

      const operations = [
        {
          key: `${testKeyPrefix}:batch-ttl:1`,
          value: "value-1",
          options: { ttl: 1 },
        },
        {
          key: `${testKeyPrefix}:batch-ttl:2`,
          value: "value-2",
          options: { ttl: 1 },
        },
      ];

      await cache.setMultiple(operations);

      // Values should exist immediately
      let results = await Promise.all([
        cache.get(`${testKeyPrefix}:batch-ttl:1`),
        cache.get(`${testKeyPrefix}:batch-ttl:2`),
      ]);

      expect(results[0]).toBe("value-1");
      expect(results[1]).toBe("value-2");

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Values should be expired
      results = await Promise.all([
        cache.get(`${testKeyPrefix}:batch-ttl:1`),
        cache.get(`${testKeyPrefix}:batch-ttl:2`),
      ]);

      expect(results[0]).toBeNull();
      expect(results[1]).toBeNull();
    });

    it("should handle empty batch operations", async () => {
      if (!redisAvailable) return;

      await expect(cache.setMultiple([])).resolves.not.toThrow();
    });

    it("should handle mixed TTL in batch operations", async () => {
      if (!redisAvailable) return;

      const operations = [
        {
          key: `${testKeyPrefix}:batch-mixed:1`,
          value: "value-1",
        },
        {
          key: `${testKeyPrefix}:batch-mixed:2`,
          value: "value-2",
          options: { ttl: 10 },
        },
      ];

      await cache.setMultiple(operations);

      const results = await Promise.all([
        cache.get(`${testKeyPrefix}:batch-mixed:1`),
        cache.get(`${testKeyPrefix}:batch-mixed:2`),
      ]);

      expect(results[0]).toBe("value-1");
      expect(results[1]).toBe("value-2");

      await Promise.all([
        cache.delete(`${testKeyPrefix}:batch-mixed:1`),
        cache.delete(`${testKeyPrefix}:batch-mixed:2`),
      ]);
    });
  });

  describe("Lock Operations", () => {
    it("should acquire lock successfully", async () => {
      if (!redisAvailable) return;

      const lockKey = `${testKeyPrefix}:lock:acquire`;
      const lockValue = "worker-1";

      const acquired = await cache.acquireLock(lockKey, lockValue, 10);

      expect(acquired).toBe(true);

      await cache.releaseLock(lockKey, lockValue);
    });

    it("should fail to acquire lock when already held", async () => {
      if (!redisAvailable) return;

      const lockKey = `${testKeyPrefix}:lock:already-held`;

      await cache.acquireLock(lockKey, "worker-1", 10);
      const acquired = await cache.acquireLock(lockKey, "worker-2", 10);

      expect(acquired).toBe(false);

      await cache.releaseLock(lockKey, "worker-1");
    });

    it("should release lock successfully", async () => {
      if (!redisAvailable) return;

      const lockKey = `${testKeyPrefix}:lock:release`;
      const lockValue = "worker-1";

      await cache.acquireLock(lockKey, lockValue, 10);
      const released = await cache.releaseLock(lockKey, lockValue);

      expect(released).toBe(true);
    });

    it("should fail to release lock with wrong value", async () => {
      if (!redisAvailable) return;

      const lockKey = `${testKeyPrefix}:lock:wrong-value`;

      await cache.acquireLock(lockKey, "worker-1", 10);
      const released = await cache.releaseLock(lockKey, "worker-2");

      expect(released).toBe(false);

      await cache.releaseLock(lockKey, "worker-1");
    });

    it("should extend lock TTL successfully", async () => {
      if (!redisAvailable) return;

      const lockKey = `${testKeyPrefix}:lock:extend`;
      const lockValue = "worker-1";

      await cache.acquireLock(lockKey, lockValue, 2);
      const extended = await cache.extendLock(lockKey, lockValue, 10);

      expect(extended).toBe(true);

      // Verify lock still exists after original TTL would have expired
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const value = await cache.get(lockKey);
      expect(value).toBe(lockValue);

      await cache.releaseLock(lockKey, lockValue);
    });

    it("should fail to extend lock with wrong value", async () => {
      if (!redisAvailable) return;

      const lockKey = `${testKeyPrefix}:lock:extend-wrong`;

      await cache.acquireLock(lockKey, "worker-1", 10);
      const extended = await cache.extendLock(lockKey, "worker-2", 10);

      expect(extended).toBe(false);

      await cache.releaseLock(lockKey, "worker-1");
    });

    it("should fail to extend non-existent lock", async () => {
      if (!redisAvailable) return;

      const lockKey = `${testKeyPrefix}:lock:extend-nonexistent`;
      const extended = await cache.extendLock(lockKey, "worker-1", 10);

      expect(extended).toBe(false);
    });

    it("should allow re-acquiring lock after expiry", async () => {
      if (!redisAvailable) return;

      const lockKey = `${testKeyPrefix}:lock:reacquire`;

      await cache.acquireLock(lockKey, "worker-1", 1);

      // Wait for lock to expire
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const acquired = await cache.acquireLock(lockKey, "worker-2", 10);
      expect(acquired).toBe(true);

      await cache.releaseLock(lockKey, "worker-2");
    });

    it("should verify lock is held by correct value", async () => {
      if (!redisAvailable) return;

      const lockKey = `${testKeyPrefix}:lock:verify-correct`;
      const lockValue = "worker-1";

      await cache.acquireLock(lockKey, lockValue, 10);
      const verified = await cache.verifyLock(lockKey, lockValue);

      expect(verified).toBe(true);

      await cache.releaseLock(lockKey, lockValue);
    });

    it("should fail verification with wrong value", async () => {
      if (!redisAvailable) return;

      const lockKey = `${testKeyPrefix}:lock:verify-wrong`;

      await cache.acquireLock(lockKey, "worker-1", 10);
      const verified = await cache.verifyLock(lockKey, "worker-2");

      expect(verified).toBe(false);

      await cache.releaseLock(lockKey, "worker-1");
    });

    it("should fail verification when lock does not exist", async () => {
      if (!redisAvailable) return;

      const lockKey = `${testKeyPrefix}:lock:verify-nonexistent`;
      const verified = await cache.verifyLock(lockKey, "worker-1");

      expect(verified).toBe(false);
    });
  });

  describe("setMultipleWithLockVerification", () => {
    it("should successfully save when lock is held", async () => {
      if (!redisAvailable) return;

      const lockKey = `${testKeyPrefix}:lock:atomic-save`;
      const lockValue = "worker-1";

      // Acquire lock
      await cache.acquireLock(lockKey, lockValue, 10);

      // Perform atomic save with lock verification
      const operations = [
        {
          key: `${testKeyPrefix}:atomic:state`,
          value: JSON.stringify({ status: "running", step: 1 }),
        },
        {
          key: `${testKeyPrefix}:atomic:counter`,
          value: "5",
          options: { ttl: 100 },
        },
      ];

      const result = await cache.setMultipleWithLockVerification(
        lockKey,
        lockValue,
        operations,
      );

      expect(result.success).toBe(true);
      expect(result.reason).toBeUndefined();

      // Verify data was saved
      const stateValue = await cache.get(`${testKeyPrefix}:atomic:state`);
      const counterValue = await cache.get(`${testKeyPrefix}:atomic:counter`);

      expect(stateValue).toBe(JSON.stringify({ status: "running", step: 1 }));
      expect(counterValue).toBe("5");

      // Cleanup
      await cache.releaseLock(lockKey, lockValue);
      await cache.delete(`${testKeyPrefix}:atomic:state`);
      await cache.delete(`${testKeyPrefix}:atomic:counter`);
    });

    it("should fail when lock is not held", async () => {
      if (!redisAvailable) return;

      const lockKey = `${testKeyPrefix}:lock:atomic-save-no-lock`;
      const lockValue = "worker-1";

      // Don't acquire lock - just try to save
      const operations = [
        {
          key: `${testKeyPrefix}:atomic:should-not-exist`,
          value: "test",
        },
      ];

      const result = await cache.setMultipleWithLockVerification(
        lockKey,
        lockValue,
        operations,
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe("lock_expired");

      // Verify data was NOT saved
      const value = await cache.get(`${testKeyPrefix}:atomic:should-not-exist`);
      expect(value).toBeNull();
    });

    it("should fail when lock is held by different worker", async () => {
      if (!redisAvailable) return;

      const lockKey = `${testKeyPrefix}:lock:atomic-save-wrong-worker`;

      // Worker 1 acquires lock
      await cache.acquireLock(lockKey, "worker-1", 10);

      // Worker 2 tries to save with wrong lock value
      const operations = [
        {
          key: `${testKeyPrefix}:atomic:wrong-worker`,
          value: "test",
        },
      ];

      const result = await cache.setMultipleWithLockVerification(
        lockKey,
        "worker-2",
        operations,
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe("lock_stolen");

      // Verify data was NOT saved
      const value = await cache.get(`${testKeyPrefix}:atomic:wrong-worker`);
      expect(value).toBeNull();

      // Cleanup
      await cache.releaseLock(lockKey, "worker-1");
    });

    it("should handle operations with deletions atomically", async () => {
      if (!redisAvailable) return;

      const lockKey = `${testKeyPrefix}:lock:atomic-save-with-dels`;
      const lockValue = "worker-1";

      // Set up some keys to delete
      await cache.set(`${testKeyPrefix}:atomic:to-delete-1`, "old-value-1");
      await cache.set(`${testKeyPrefix}:atomic:to-delete-2`, "old-value-2");

      // Acquire lock
      await cache.acquireLock(lockKey, lockValue, 10);

      // Perform atomic save with deletions
      const operations = [
        {
          key: `${testKeyPrefix}:atomic:new-state`,
          value: "new-state-value",
        },
      ];

      const deleteKeys = [
        `${testKeyPrefix}:atomic:to-delete-1`,
        `${testKeyPrefix}:atomic:to-delete-2`,
      ];

      const result = await cache.setMultipleWithLockVerification(
        lockKey,
        lockValue,
        operations,
        deleteKeys,
      );

      expect(result.success).toBe(true);

      // Verify new state was saved
      const newValue = await cache.get(`${testKeyPrefix}:atomic:new-state`);
      expect(newValue).toBe("new-state-value");

      // Verify old keys were deleted
      const deleted1 = await cache.get(`${testKeyPrefix}:atomic:to-delete-1`);
      const deleted2 = await cache.get(`${testKeyPrefix}:atomic:to-delete-2`);
      expect(deleted1).toBeNull();
      expect(deleted2).toBeNull();

      // Cleanup
      await cache.releaseLock(lockKey, lockValue);
      await cache.delete(`${testKeyPrefix}:atomic:new-state`);
    });

    it("should prevent TOCTOU race condition", async () => {
      if (!redisAvailable) return;

      const lockKey = `${testKeyPrefix}:lock:atomic-save-toctou`;
      const lockValue = "worker-1";

      // Worker 1 acquires lock
      await cache.acquireLock(lockKey, lockValue, 1);

      // Wait for lock to expire (simulating slow execution)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Try to save after lock expired - should fail
      const operations = [
        {
          key: `${testKeyPrefix}:atomic:toctou-test`,
          value: "should-not-save",
        },
      ];

      const result = await cache.setMultipleWithLockVerification(
        lockKey,
        lockValue,
        operations,
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe("lock_expired");

      // Verify data was NOT saved (atomic operation prevented TOCTOU)
      const value = await cache.get(`${testKeyPrefix}:atomic:toctou-test`);
      expect(value).toBeNull();
    });

    it("should handle empty operations gracefully", async () => {
      if (!redisAvailable) return;

      const lockKey = `${testKeyPrefix}:lock:atomic-save-empty`;
      const lockValue = "worker-1";

      await cache.acquireLock(lockKey, lockValue, 10);

      const result = await cache.setMultipleWithLockVerification(
        lockKey,
        lockValue,
        [],
      );

      expect(result.success).toBe(true);

      await cache.releaseLock(lockKey, lockValue);
    });
  });
});
