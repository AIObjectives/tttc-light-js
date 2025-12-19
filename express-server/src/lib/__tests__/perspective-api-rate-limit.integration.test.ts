/**
 * Integration tests for global Perspective API rate limiting.
 *
 * These tests verify that the Redis-based global rate limiter correctly
 * enforces 1 QPS across concurrent callers.
 *
 * Requires Redis to be running locally (redis://localhost:6379).
 * Skip these tests in environments without Redis.
 */

import Redis from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Test configuration - matches production constants
const GLOBAL_RATE_LIMIT_KEY = "perspective:global-rate-limit";
const GLOBAL_RATE_LIMIT_INTERVAL_MS = 1000;
const GLOBAL_RATE_LIMIT_TTL_SECONDS = 60;
const GLOBAL_RATE_LIMIT_POLL_MS = 50;

const RATE_LIMIT_LUA_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local minInterval = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

local lastCall = redis.call('GET', key)

if lastCall == false then
  redis.call('SETEX', key, ttl, now)
  return 0
end

local elapsed = now - tonumber(lastCall)

if elapsed >= minInterval then
  redis.call('SETEX', key, ttl, now)
  return 0
else
  return minInterval - elapsed
end
`;

/**
 * Acquire global rate limit slot using Redis.
 * This is a copy of the production function for isolated testing.
 */
async function acquireGlobalRateLimit(redis: Redis): Promise<void> {
  while (true) {
    const now = Date.now();
    const result = await redis.eval(
      RATE_LIMIT_LUA_SCRIPT,
      1,
      GLOBAL_RATE_LIMIT_KEY,
      now,
      GLOBAL_RATE_LIMIT_INTERVAL_MS,
      GLOBAL_RATE_LIMIT_TTL_SECONDS,
    );

    if (result === 0) {
      return;
    }

    const waitTime = Math.min(GLOBAL_RATE_LIMIT_POLL_MS, result as number);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
}

describe("Global Rate Limiting Integration", () => {
  let redis: Redis;
  let redisAvailable = false;

  beforeAll(async () => {
    try {
      redis = new Redis({
        host: "localhost",
        port: 6379,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // Don't retry on failure
      });

      // Test connection
      await redis.ping();
      redisAvailable = true;
    } catch {
      console.warn(
        "Redis not available, skipping global rate limiting integration tests",
      );
      redisAvailable = false;
    }
  });

  afterAll(async () => {
    if (redisAvailable && redis) {
      await redis.del(GLOBAL_RATE_LIMIT_KEY);
      redis.disconnect();
    }
  });

  beforeEach(async () => {
    if (redisAvailable) {
      await redis.del(GLOBAL_RATE_LIMIT_KEY);
    }
  });

  it("allows immediate acquisition when no recent calls", async () => {
    if (!redisAvailable) {
      console.log("Skipping: Redis not available");
      return;
    }

    const startTime = Date.now();
    await acquireGlobalRateLimit(redis);
    const elapsed = Date.now() - startTime;

    // First call should be nearly immediate (< 100ms)
    expect(elapsed).toBeLessThan(100);
  });

  it("enforces 1 QPS across sequential calls", async () => {
    if (!redisAvailable) {
      console.log("Skipping: Redis not available");
      return;
    }

    const times: number[] = [];

    for (let i = 0; i < 3; i++) {
      await acquireGlobalRateLimit(redis);
      times.push(Date.now());
    }

    // Each call should be ~1000ms apart (with some tolerance)
    const diff1 = times[1] - times[0];
    const diff2 = times[2] - times[1];

    expect(diff1).toBeGreaterThanOrEqual(950);
    expect(diff1).toBeLessThan(1200);
    expect(diff2).toBeGreaterThanOrEqual(950);
    expect(diff2).toBeLessThan(1200);
  });

  it("enforces 1 QPS across concurrent calls", async () => {
    if (!redisAvailable) {
      console.log("Skipping: Redis not available");
      return;
    }

    const times: number[] = [];

    // Simulate 3 concurrent pipelines trying to acquire rate limit
    await Promise.all([
      acquireGlobalRateLimit(redis).then(() => times.push(Date.now())),
      acquireGlobalRateLimit(redis).then(() => times.push(Date.now())),
      acquireGlobalRateLimit(redis).then(() => times.push(Date.now())),
    ]);

    times.sort((a, b) => a - b);

    // Each acquisition should be ~1000ms apart
    const diff1 = times[1] - times[0];
    const diff2 = times[2] - times[1];

    expect(diff1).toBeGreaterThanOrEqual(950);
    expect(diff2).toBeGreaterThanOrEqual(950);

    // Total time for 3 calls at 1 QPS should be ~2000ms
    const totalTime = times[2] - times[0];
    expect(totalTime).toBeGreaterThanOrEqual(1900);
    expect(totalTime).toBeLessThan(2500);
  });

  it("stores correct timestamp in Redis after acquisition", async () => {
    if (!redisAvailable) {
      console.log("Skipping: Redis not available");
      return;
    }

    const beforeCall = Date.now();
    await acquireGlobalRateLimit(redis);
    const afterCall = Date.now();

    const storedValue = await redis.get(GLOBAL_RATE_LIMIT_KEY);
    expect(storedValue).not.toBeNull();

    const storedTimestamp = parseInt(storedValue!, 10);

    // Stored timestamp should be between before and after call
    expect(storedTimestamp).toBeGreaterThanOrEqual(beforeCall);
    expect(storedTimestamp).toBeLessThanOrEqual(afterCall);
  });

  it("sets correct TTL on rate limit key", async () => {
    if (!redisAvailable) {
      console.log("Skipping: Redis not available");
      return;
    }

    await acquireGlobalRateLimit(redis);

    const ttl = await redis.ttl(GLOBAL_RATE_LIMIT_KEY);

    // TTL should be close to 60 seconds (within a few seconds)
    expect(ttl).toBeGreaterThan(55);
    expect(ttl).toBeLessThanOrEqual(60);
  });

  it("handles high concurrency without exceeding 1 QPS", async () => {
    if (!redisAvailable) {
      console.log("Skipping: Redis not available");
      return;
    }

    const NUM_CONCURRENT = 5;
    const times: number[] = [];

    // Simulate 5 concurrent pipelines
    const startTime = Date.now();
    await Promise.all(
      Array(NUM_CONCURRENT)
        .fill(null)
        .map(() =>
          acquireGlobalRateLimit(redis).then(() => times.push(Date.now())),
        ),
    );
    const totalTime = Date.now() - startTime;

    times.sort((a, b) => a - b);

    // 5 acquisitions at 1 QPS should take ~4 seconds
    // (first is immediate, then 4 more at 1/second)
    expect(totalTime).toBeGreaterThanOrEqual(3800);
    expect(totalTime).toBeLessThan(5500);

    // Check intervals between acquisitions
    for (let i = 1; i < times.length; i++) {
      const interval = times[i] - times[i - 1];
      expect(interval).toBeGreaterThanOrEqual(900); // Allow some tolerance
    }
  });
});
