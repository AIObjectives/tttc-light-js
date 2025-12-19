import { GCPBucketStore } from "./providers/gcp";
import type { BucketStore, BucketStoreConfig } from "./types";

export type {
  BucketStore,
  BucketStoreConfig,
  GCPBucketStoreConfig,
} from "./types";
export {
  AccessDeniedError,
  BucketNotFoundError,
  BucketStoreError,
  UploadFailedError,
  UrlGenerationFailedError,
} from "./types";

/**
 * Factory function that creates a BucketStore implementation based on the provided configuration.
 *
 * @param config - Configuration object specifying the provider and its settings
 * @returns A BucketStore implementation for the specified provider
 * @throws Error if the provider is not supported
 *
 * @example
 * ```typescript
 * const store = createBucketStore({
 *   provider: "gcp",
 *   bucketName: "my-bucket",
 *   projectId: "my-project"
 * });
 * ```
 */
export function createBucketStore(config: BucketStoreConfig): BucketStore {
  switch (config.provider) {
    case "gcp":
      return new GCPBucketStore(config.bucketName, config.projectId);
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}
