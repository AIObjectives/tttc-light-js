import { RedisCache } from "./providers/redis";
import type { Cache, CacheConfig } from "./types";

export type { Cache, CacheConfig, RedisCacheConfig, SetOptions } from "./types";
export {
  CacheConnectionError,
  CacheDeleteError,
  CacheError,
  CacheGetError,
  CacheSetError,
} from "./types";

/**
 * Factory function that creates a Cache implementation based on the provided configuration.
 *
 * @param config - Configuration object specifying the provider and its settings
 * @returns A Cache implementation for the specified provider
 * @throws Error if the provider is not supported
 *
 * @example
 * ```typescript
 * const cache = createCache({
 *   provider: "redis",
 *   host: "localhost",
 *   port: 6379,
 *   password: "optional-password",
 *   db: 0
 * });
 * ```
 */
export function createCache(config: CacheConfig): Cache {
  switch (config.provider) {
    case "redis":
      return new RedisCache(config);
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}
