import { createCache } from "./index";
import type { Cache, RedisCacheConfig } from "./types";

/**
 * Parses Redis configuration from environment variables.
 *
 * @param env - Environment variables object
 * @returns Parsed Redis cache configuration
 * @throws Error if REDIS_URL is not provided
 */
const parseConfig = (env: {
  [key: string]: string | undefined;
}): RedisCacheConfig => {
  const redisUrl = env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL environment variable is required");
  }

  // Parse Redis URL: redis://[username][:password@]host[:port][/db]
  const url = new URL(redisUrl);

  // Extract database number from pathname, handling edge cases
  // - Empty pathname: default to 0
  // - "/" only: default to 0
  // - "/0", "/1", etc.: parse the number
  let db = 0;
  if (url.pathname && url.pathname !== "/") {
    const dbString = url.pathname.slice(1); // Remove leading "/"
    if (dbString) {
      db = parseInt(dbString, 10);
    }
  }

  return {
    provider: "redis",
    host: url.hostname || "localhost",
    port: parseInt(url.port || "6379", 10),
    password: url.password || undefined,
    db,
  };
};

/**
 * Creates and initializes a Cache service from environment variables.
 *
 * This function follows the RefStore service initialization pattern,
 * parsing configuration from environment variables and creating a cache instance.
 *
 * @param env - Environment variables object (typically process.env)
 * @returns Initialized Cache instance
 * @throws Error if REDIS_URL is not provided or invalid
 *
 * @example
 * ```typescript
 * // Initialize cache with REDIS_URL environment variable
 * const cache = CacheServicesLive(process.env);
 *
 * // Use the cache
 * await cache.set("key", "value", { ttl: 60 });
 * const value = await cache.get("key");
 * ```
 */
export const CacheServicesLive = (env: {
  [key: string]: string | undefined;
}): Cache => {
  const config = parseConfig(env);
  return createCache(config);
};
