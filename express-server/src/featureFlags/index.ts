import type {
  FeatureFlagConfig,
  FeatureFlagContext,
  FeatureFlagProvider,
} from "tttc-common/feature-flags";
import {
  getFeatureFlag,
  getFeatureFlagProvider,
  initializeFeatureFlags as initializeFeatureFlagsCommon,
  isFeatureEnabled,
  shutdownFeatureFlags,
} from "tttc-common/feature-flags";
import type { Env } from "../types/context";

/**
 * Initializes feature flags for the express server using environment configuration.
 * Converts express-server Env type to common FeatureFlagConfig.
 *
 * @param env - Express server environment configuration
 * @returns The initialized feature flag provider
 */
export function initializeFeatureFlags(env: Env): FeatureFlagProvider {
  const config: FeatureFlagConfig = {
    provider: env.FEATURE_FLAG_PROVIDER,
    apiKey: env.FEATURE_FLAG_API_KEY,
    host: env.FEATURE_FLAG_HOST,
    localFlags: env.LOCAL_FLAGS,
  };

  return initializeFeatureFlagsCommon(config);
}

// Re-export all other functions and types from common
export {
  isFeatureEnabled,
  getFeatureFlag,
  shutdownFeatureFlags,
  getFeatureFlagProvider,
};
export type { FeatureFlagProvider, FeatureFlagContext };
