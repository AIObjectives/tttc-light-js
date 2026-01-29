/**
 * Base class for all cache errors
 */
export class CacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CacheError";
  }
}

/**
 * Error thrown when cache connection or initialization fails
 */
export class CacheConnectionError extends CacheError {
  constructor(public reason: string) {
    super(`Cache connection failed: ${reason}`);
    this.name = "CacheConnectionError";
  }
}

/**
 * Error thrown when a cache get operation fails
 */
export class CacheGetError extends CacheError {
  constructor(
    public key: string,
    public reason: string,
  ) {
    super(`Get failed for key ${key}: ${reason}`);
    this.name = "CacheGetError";
  }
}

/**
 * Error thrown when a cache set operation fails
 */
export class CacheSetError extends CacheError {
  constructor(
    public key: string,
    public reason: string,
  ) {
    super(`Set failed for key ${key}: ${reason}`);
    this.name = "CacheSetError";
  }
}

/**
 * Error thrown when a cache delete operation fails
 */
export class CacheDeleteError extends CacheError {
  constructor(
    public key: string,
    public reason: string,
  ) {
    super(`Delete failed for key ${key}: ${reason}`);
    this.name = "CacheDeleteError";
  }
}

/**
 * Options for cache set operations
 */
export type SetOptions = {
  /**
   * Time to live in seconds. If not specified, the key will not expire.
   */
  ttl?: number;
};

/**
 * Generic interface for cache storage operations.
 *
 * This interface provides a cache-agnostic abstraction for storing
 * key-value pairs in a cache (e.g., Redis, Memcached).
 */
export interface Cache {
  /**
   * Stores a value in the cache with optional expiration.
   *
   * @param key - The cache key
   * @param value - The value to store as a string
   * @param options - Optional settings for the set operation
   * @returns A Promise that resolves when the value is stored
   * @throws {CacheSetError} When the set operation fails
   * @throws {CacheConnectionError} When connection is not available
   */
  set(key: string, value: string, options?: SetOptions): Promise<void>;

  /**
   * Retrieves a value from the cache.
   *
   * @param key - The cache key
   * @returns A Promise containing the value if found, or null if not found or expired
   * @throws {CacheGetError} When the get operation fails
   * @throws {CacheConnectionError} When connection is not available
   */
  get(key: string): Promise<string | null>;

  /**
   * Deletes a key from the cache.
   *
   * @param key - The cache key to delete
   * @returns A Promise that resolves when the key is deleted
   * @throws {CacheDeleteError} When the delete operation fails
   * @throws {CacheConnectionError} When connection is not available
   */
  delete(key: string): Promise<void>;

  /**
   * Attempts to acquire a distributed lock using SET NX (set if not exists).
   *
   * @param key - The lock key
   * @param value - Unique identifier for this lock holder (e.g., worker ID)
   * @param ttlSeconds - Lock expiration time in seconds
   * @returns true if lock was acquired, false if already held by another process
   * @throws {CacheSetError} When the operation fails
   */
  acquireLock(key: string, value: string, ttlSeconds: number): Promise<boolean>;

  /**
   * Releases a distributed lock (only if held by this value).
   *
   * @param key - The lock key
   * @param value - Unique identifier that acquired the lock
   * @returns true if lock was released, false if not held or held by different value
   * @throws {CacheDeleteError} When the operation fails
   */
  releaseLock(key: string, value: string): Promise<boolean>;

  /**
   * Extends the TTL of a distributed lock (only if held by this value).
   *
   * @param key - The lock key
   * @param value - Unique identifier that acquired the lock
   * @param ttlSeconds - New expiration time in seconds
   * @returns true if lock TTL was extended, false if not held or held by different value
   * @throws {CacheSetError} When the operation fails
   */
  extendLock(key: string, value: string, ttlSeconds: number): Promise<boolean>;

  /**
   * Atomically increments a counter by 1 and returns the new value.
   *
   * @param key - The counter key
   * @param ttlSeconds - Optional TTL to set on the key after incrementing
   * @returns The new value after incrementing
   * @throws {CacheSetError} When the operation fails
   */
  increment(key: string, ttlSeconds?: number): Promise<number>;
}

/**
 * Configuration for Redis cache provider
 */
export type RedisCacheConfig = {
  provider: "redis";
  host: string;
  port: number;
  password?: string;
  db?: number;
};

/**
 * Union type for all supported cache providers.
 * Add new provider configs here as they are implemented.
 */
export type CacheConfig = RedisCacheConfig;
