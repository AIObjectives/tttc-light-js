import {
  type FeatureFlagConfig,
  type FeatureFlagContext,
  type FeatureFlagProvider,
  getFeatureFlag,
  getFeatureFlagProvider,
  initializeFeatureFlags as initializeFeatureFlagsCommon,
  isFeatureEnabled,
  shutdownFeatureFlags,
} from "tttc-common/feature-flags";

/**
 * Server-side feature flag implementation for Next.js.
 * Uses the full @common implementation which includes PostHog Node SDK.
 * Use this in Server Components, API Routes, and Server Actions.
 */

/**
 * Environment configuration for Next.js server-side feature flags.
 */
export interface NextServerFeatureFlagEnv {
  /**
   * Feature flag provider to use (local or posthog).
   */
  FEATURE_FLAG_PROVIDER?: "local" | "posthog";

  /**
   * PostHog API key (required when using posthog provider).
   */
  FEATURE_FLAG_API_KEY?: string;

  /**
   * PostHog host URL (optional, defaults to https://app.posthog.com).
   */
  FEATURE_FLAG_HOST?: string;

  /**
   * Local flags as a JSON string (used when provider is "local").
   */
  LOCAL_FLAGS?: string;
}

/**
 * Initializes feature flags for Next.js server-side using environment configuration.
 * Converts Next.js server environment variables to common FeatureFlagConfig.
 *
 * @param env - Next.js server environment configuration
 * @returns The initialized feature flag provider
 */
export function initializeFeatureFlags(
  env: Partial<NextServerFeatureFlagEnv> = {},
): FeatureFlagProvider {
  const envVars = {
    FEATURE_FLAG_PROVIDER:
      env.FEATURE_FLAG_PROVIDER || process.env.FEATURE_FLAG_PROVIDER,
    FEATURE_FLAG_API_KEY:
      env.FEATURE_FLAG_API_KEY || process.env.FEATURE_FLAG_API_KEY,
    FEATURE_FLAG_HOST: env.FEATURE_FLAG_HOST || process.env.FEATURE_FLAG_HOST,
    LOCAL_FLAGS: env.LOCAL_FLAGS || process.env.LOCAL_FLAGS,
  };

  const provider = (envVars.FEATURE_FLAG_PROVIDER || "local") as
    | "local"
    | "posthog";

  let localFlags: Record<string, boolean | string | number> | undefined;
  if (envVars.LOCAL_FLAGS) {
    try {
      localFlags = JSON.parse(envVars.LOCAL_FLAGS);
    } catch (error) {
      console.error("Failed to parse LOCAL_FLAGS:", error);
      localFlags = {};
    }
  }

  const config: FeatureFlagConfig = {
    provider,
    apiKey: envVars.FEATURE_FLAG_API_KEY,
    host: envVars.FEATURE_FLAG_HOST,
    localFlags,
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
