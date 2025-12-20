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
   * Disconnects from Redis gracefully.
   * Should be called when shutting down the application or in test cleanup.
   */
  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}
