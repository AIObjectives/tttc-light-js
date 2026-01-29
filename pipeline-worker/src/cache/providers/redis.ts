import Redis from "ioredis";
import { logger } from "tttc-common/logger";
import { formatError } from "tttc-common/utils";
import {
  type Cache,
  CacheConnectionError,
  CacheDeleteError,
  CacheGetError,
  CacheSetError,
  type RedisCacheConfig,
  type SetOptions,
} from "../types";

const cacheLogger = logger.child({ module: "cache-redis" });

/**
 * Redis implementation of the Cache interface using ioredis.
 *
 * This implementation uses ioredis to store key-value pairs with optional expiration.
 *
 * Authentication is handled via:
 * - password in the configuration (if required by Redis server)
 * - connection URL with credentials
 *
 * Connection is established immediately on instantiation (lazyConnect: false).
 * This ensures connection errors are caught early during service initialization.
 */
export class RedisCache implements Cache {
  private client: Redis;

  /**
   * Creates a new RedisCache instance.
   *
   * @param config - Redis configuration including host, port, password, and db
   */
  constructor(config: RedisCacheConfig) {
    try {
      this.client = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db,
        connectionName: "Pipeline-Cache",
        lazyConnect: false,
        // Retry strategy for automatic reconnection
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          cacheLogger.warn(
            { attempt: times, delayMs: delay, host: config.host },
            "Retrying Redis connection",
          );
          return delay;
        },
        // Maximum retry attempts
        maxRetriesPerRequest: 3,
      });

      // Handle connection errors (both initial and runtime)
      this.client.on("error", (err) => {
        cacheLogger.error(
          { error: err, host: config.host, port: config.port },
          "Redis connection error",
        );
      });

      // Log successful connection readiness
      this.client.on("ready", () => {
        cacheLogger.info(
          { host: config.host, port: config.port },
          "Redis cache connected",
        );
      });

      // Log reconnection attempts
      this.client.on("reconnecting", (timeToReconnect: number) => {
        cacheLogger.warn(
          { timeToReconnect, host: config.host, port: config.port },
          "Redis cache reconnecting",
        );
      });

      // Log when connection is closed
      this.client.on("close", () => {
        cacheLogger.warn(
          { host: config.host, port: config.port },
          "Redis cache connection closed",
        );
      });
    } catch (error) {
      cacheLogger.error(
        { error, config: { host: config.host, port: config.port } },
        "Failed to initialize Redis cache",
      );
      throw new CacheConnectionError(formatError(error));
    }
  }

  /**
   * Stores a value in the cache with optional expiration.
   *
   * @param key - The cache key
   * @param value - The value to store
   * @param options - Optional settings including TTL in seconds
   * @throws {CacheSetError} When the set operation fails
   */
  async set(key: string, value: string, options?: SetOptions): Promise<void> {
    try {
      if (options?.ttl !== undefined) {
        // Set with expiration using setex
        await this.client.setex(key, options.ttl, value);
      } else {
        // Set without expiration
        await this.client.set(key, value);
      }
    } catch (error) {
      throw new CacheSetError(key, formatError(error));
    }
  }

  /**
   * Retrieves a value from the cache.
   *
   * @param key - The cache key
   * @returns The value if found, or null if not found or expired
   * @throws {CacheGetError} When the get operation fails
   */
  async get(key: string): Promise<string | null> {
    try {
      const value = await this.client.get(key);
      return value;
    } catch (error) {
      throw new CacheGetError(key, formatError(error));
    }
  }

  /**
   * Deletes a key from the cache.
   *
   * @param key - The cache key to delete
   * @throws {CacheDeleteError} When the delete operation fails
   */
  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      throw new CacheDeleteError(key, formatError(error));
    }
  }

  /**
   * Attempts to acquire a distributed lock using SET NX.
   *
   * @param key - The lock key
   * @param value - Unique identifier for this lock holder
   * @param ttlSeconds - Lock expiration time in seconds
   * @returns true if lock was acquired, false if already held
   * @throws {CacheSetError} When the operation fails
   */
  async acquireLock(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    try {
      // SET key value NX EX ttl
      // Returns "OK" if set, null if key already exists
      const result = await this.client.set(key, value, "EX", ttlSeconds, "NX");
      return result === "OK";
    } catch (error) {
      throw new CacheSetError(
        key,
        `Lock acquisition failed: ${formatError(error)}`,
      );
    }
  }

  /**
   * Releases a distributed lock (only if held by this value).
   *
   * @param key - The lock key
   * @param value - Unique identifier that acquired the lock
   * @returns true if lock was released, false if not held or held by different value
   * @throws {CacheDeleteError} When the operation fails
   */
  async releaseLock(key: string, value: string): Promise<boolean> {
    try {
      // Lua script to atomically check value and delete if it matches
      // This ensures we only release our own lock
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.client.eval(script, 1, key, value);
      return result === 1;
    } catch (error) {
      throw new CacheDeleteError(
        key,
        `Lock release failed: ${formatError(error)}`,
      );
    }
  }

  /**
   * Extends the TTL of a distributed lock (only if held by this value).
   *
   * @param key - The lock key
   * @param value - Unique identifier that acquired the lock
   * @param ttlSeconds - New expiration time in seconds
   * @returns true if lock TTL was extended, false if not held or held by different value
   * @throws {CacheSetError} When the operation fails
   */
  async extendLock(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    try {
      // Lua script to atomically check value and extend TTL if it matches
      // This ensures we only extend our own lock
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("expire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = await this.client.eval(script, 1, key, value, ttlSeconds);
      return result === 1;
    } catch (error) {
      throw new CacheSetError(
        key,
        `Lock extension failed: ${formatError(error)}`,
      );
    }
  }

  /**
   * Atomically increments a counter by 1 and returns the new value.
   * Optionally sets a TTL on the key after incrementing.
   *
   * @param key - The counter key
   * @param ttlSeconds - Optional TTL to set on the key after incrementing
   * @returns The new value after incrementing
   * @throws {CacheSetError} When the operation fails
   */
  async increment(key: string, ttlSeconds?: number): Promise<number> {
    try {
      // Use a Lua script to atomically increment and set TTL
      // This ensures both operations happen atomically
      if (ttlSeconds !== undefined) {
        const script = `
          local count = redis.call("incr", KEYS[1])
          redis.call("expire", KEYS[1], ARGV[1])
          return count
        `;
        const newValue = await this.client.eval(script, 1, key, ttlSeconds);
        return newValue as number;
      } else {
        // Simple INCR when no TTL is needed
        const newValue = await this.client.incr(key);
        return newValue;
      }
    } catch (error) {
      throw new CacheSetError(
        key,
        `Counter increment failed: ${formatError(error)}`,
      );
    }
  }

  /**
   * Executes multiple set operations atomically using Redis pipeline (MULTI/EXEC).
   * All operations either succeed together or fail together.
   *
   * @param operations - Array of set operations to execute atomically
   * @throws {CacheSetError} When any operation fails
   */
  async setMultiple(
    operations: Array<{ key: string; value: string; options?: SetOptions }>,
  ): Promise<void> {
    if (operations.length === 0) {
      return;
    }

    try {
      const multi = this.buildPipeline(operations);
      const results = await multi.exec();
      this.validatePipelineResults(results);
    } catch (error) {
      const keys = operations.map((op) => op.key).join(", ");
      throw new CacheSetError(
        `[${keys}]`,
        `Batch set failed: ${formatError(error)}`,
      );
    }
  }

  /**
   * Builds a Redis MULTI transaction with set operations.
   *
   * @param operations - Array of set operations to add to the transaction
   * @returns Configured Redis multi transaction
   */
  private buildPipeline(
    operations: Array<{ key: string; value: string; options?: SetOptions }>,
  ): ReturnType<Redis["multi"]> {
    const multi = this.client.multi();

    for (const op of operations) {
      if (op.options?.ttl !== undefined) {
        multi.setex(op.key, op.options.ttl, op.value);
      } else {
        multi.set(op.key, op.value);
      }
    }

    return multi;
  }

  /**
   * Validates that all MULTI transaction operations succeeded.
   *
   * @param results - MULTI transaction execution results
   * @throws {Error} When transaction execution fails or any operation has an error
   */
  private validatePipelineResults(
    results: Array<[Error | null, unknown]> | null,
  ): void {
    if (!results) {
      throw new Error("MULTI transaction execution returned null");
    }

    for (const [error] of results) {
      if (error) {
        throw error;
      }
    }
  }

  /**
   * Verifies Redis connectivity by executing a PING command.
   *
   * @throws {CacheConnectionError} When Redis is not reachable or not ready
   */
  async healthCheck(): Promise<void> {
    try {
      const result = await this.client.ping();
      if (result !== "PONG") {
        throw new Error(`Unexpected PING response: ${result}`);
      }
    } catch (error) {
      throw new CacheConnectionError(
        `Redis health check failed: ${formatError(error)}`,
      );
    }
  }

  /**
   * Disconnects from Redis gracefully.
   * Should be called when shutting down the application or in test cleanup.
   */
  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}
