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
   * Executes multiple set and delete operations atomically using Redis pipeline (MULTI/EXEC).
   * All operations either succeed together or fail together.
   *
   * @param operations - Array of set operations to execute atomically
   * @param deleteKeys - Optional array of keys to delete atomically
   * @throws {CacheSetError} When any operation fails
   */
  async setMultiple(
    operations: Array<{ key: string; value: string; options?: SetOptions }>,
    deleteKeys?: string[],
  ): Promise<void> {
    if (operations.length === 0 && (!deleteKeys || deleteKeys.length === 0)) {
      return;
    }

    try {
      const multi = this.buildPipeline(operations, deleteKeys);
      const results = await multi.exec();
      this.validatePipelineResults(results);
    } catch (error) {
      const setKeys = operations.map((op) => op.key).join(", ");
      const delKeys = deleteKeys?.join(", ") || "";
      const allKeys = [setKeys, delKeys].filter(Boolean).join(", ");
      throw new CacheSetError(
        `[${allKeys}]`,
        `Batch operation failed: ${formatError(error)}`,
      );
    }
  }

  /**
   * Atomically verifies lock ownership and executes multiple set/delete operations.
   * This prevents TOCTOU race conditions by ensuring the lock check and state save
   * happen atomically in a single Redis Lua script execution.
   *
   * The Lua script:
   * 1. Checks if the lock key holds the expected value
   * 2. If not, returns failure reason (expired or stolen)
   * 3. If yes, executes all set/delete operations atomically
   * 4. Returns success
   *
   * @param lockKey - The lock key to verify
   * @param lockValue - Expected lock value (unique identifier of lock holder)
   * @param operations - Array of set operations to execute if lock is held
   * @param deleteKeys - Optional array of keys to delete if lock is held
   * @returns Object indicating success and reason for failure if applicable
   * @throws {CacheSetError} When the Redis operation fails
   */
  async setMultipleWithLockVerification(
    lockKey: string,
    lockValue: string,
    operations: Array<{ key: string; value: string; options?: SetOptions }>,
    deleteKeys?: string[],
  ): Promise<{ success: boolean; reason?: string }> {
    if (operations.length === 0 && (!deleteKeys || deleteKeys.length === 0)) {
      return { success: true };
    }

    try {
      // Build the Lua script dynamically based on operations
      const script = this.buildLockVerificationScript(
        operations.length,
        deleteKeys?.length || 0,
      );

      // Prepare arguments for the Lua script
      // KEYS: [lockKey, ...operationKeys, ...deleteKeys]
      // ARGV: [lockValue, ...operationValues, ...operationTTLs, ...deleteDummyArgs]
      const keys = [
        lockKey,
        ...operations.map((op) => op.key),
        ...(deleteKeys || []),
      ];

      const argv = [
        lockValue,
        ...operations.map((op) => op.value),
        ...operations.map((op) => String(op.options?.ttl || 0)),
      ];

      const result = (await this.client.eval(
        script,
        keys.length,
        ...keys,
        ...argv,
      )) as [number, string];

      if (result[0] === 1) {
        return { success: true };
      }
      return { success: false, reason: result[1] };
    } catch (error) {
      const setKeys = operations.map((op) => op.key).join(", ");
      const delKeys = deleteKeys?.join(", ") || "";
      const allKeys = [setKeys, delKeys].filter(Boolean).join(", ");
      throw new CacheSetError(
        `[${allKeys}]`,
        `Atomic lock-verified batch operation failed: ${formatError(error)}`,
      );
    }
  }

  /**
   * Builds a Redis MULTI transaction with set and delete operations.
   *
   * @param operations - Array of set operations to add to the transaction
   * @param deleteKeys - Optional array of keys to delete
   * @returns Configured Redis multi transaction
   */
  private buildPipeline(
    operations: Array<{ key: string; value: string; options?: SetOptions }>,
    deleteKeys?: string[],
  ): ReturnType<Redis["multi"]> {
    const multi = this.client.multi();

    for (const op of operations) {
      if (op.options?.ttl !== undefined) {
        multi.setex(op.key, op.options.ttl, op.value);
      } else {
        multi.set(op.key, op.value);
      }
    }

    // Add deletions to the same atomic transaction
    if (deleteKeys && deleteKeys.length > 0) {
      // Redis DEL command accepts multiple keys: DEL key1 key2 key3
      multi.del(...deleteKeys);
    }

    return multi;
  }

  /**
   * Builds a Lua script that atomically verifies a lock and performs set/delete operations.
   *
   * The script structure:
   * - KEYS[1] = lockKey
   * - KEYS[2..n] = operation keys
   * - KEYS[n+1..end] = deletion keys
   * - ARGV[1] = expected lock value
   * - ARGV[2..n+1] = operation values
   * - ARGV[n+2..end] = operation TTLs (0 means no TTL)
   *
   * @param numOperations - Number of set operations
   * @param numDeletions - Number of delete operations
   * @returns Lua script string
   */
  private buildLockVerificationScript(
    numOperations: number,
    numDeletions: number,
  ): string {
    return `
      -- Verify lock ownership
      local lock_val = redis.call("GET", KEYS[1])
      if lock_val ~= ARGV[1] then
        if lock_val == false then
          return {0, "lock_expired"}
        else
          return {0, "lock_stolen"}
        end
      end

      -- Lock is valid, perform all operations atomically
      local num_ops = ${numOperations}
      local num_dels = ${numDeletions}

      -- Execute SET operations (KEYS[2] onwards)
      for i = 1, num_ops do
        local key_idx = i + 1
        local val_idx = i + 1
        local ttl_idx = i + 1 + num_ops

        local key = KEYS[key_idx]
        local value = ARGV[val_idx]
        local ttl = tonumber(ARGV[ttl_idx])

        if ttl > 0 then
          redis.call("SETEX", key, ttl, value)
        else
          redis.call("SET", key, value)
        end
      end

      -- Execute DELETE operations (remaining KEYS)
      if num_dels > 0 then
        local del_keys = {}
        for i = 1, num_dels do
          table.insert(del_keys, KEYS[num_ops + 1 + i])
        end
        redis.call("DEL", unpack(del_keys))
      end

      return {1, "ok"}
    `;
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
