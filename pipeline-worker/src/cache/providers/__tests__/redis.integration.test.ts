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
      expect(JSON.parse(result!)).toEqual({
        foo: "bar",
        nested: { val: 123 },
        array: [1, 2, 3],
      });

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
  });
});
