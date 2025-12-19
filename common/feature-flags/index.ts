import { logger } from "../logger";
import { LocalFeatureFlagProvider } from "./providers/localProvider";
import { PostHogFeatureFlagProvider } from "./providers/posthogProvider";
import type { FeatureFlagContext, FeatureFlagProvider } from "./types";

const featureFlagsLogger = logger.child({ module: "feature-flags" });

let featureFlagProvider: FeatureFlagProvider | null = null;

/**
 * Configuration options for initializing feature flags.
 */
export interface FeatureFlagConfig {
  /**
   * The provider to use for feature flags (local or posthog).
   */
  provider: "local" | "posthog";

  /**
   * API key for PostHog (required when provider is "posthog").
   */
  apiKey?: string;

  /**
   * Host URL for PostHog (defaults to https://app.posthog.com).
   */
  host?: string;

  /**
   * Local flags to use when provider is "local".
   */
  localFlags?: Record<string, boolean | string | number>;
}

/**
 * Initializes the feature flag system with the specified configuration.
 * This should be called once at application startup.
 * Subsequent calls will return the existing provider instance.
 *
 * @param config - Configuration for feature flags
 * @returns The initialized feature flag provider
 * @throws Error if PostHog provider is selected without an API key
 * @throws Error if an unknown provider is specified
 */
export function initializeFeatureFlags(
  config: FeatureFlagConfig,
): FeatureFlagProvider {
  if (featureFlagProvider) {
    return featureFlagProvider;
  }

  switch (config.provider) {
    case "posthog":
      if (!config.apiKey) {
        throw new Error("PostHog API key is required for PostHog provider");
      }
      featureFlagProvider = new PostHogFeatureFlagProvider(
        config.apiKey,
        config.host,
      );
      break;
    case "local":
      featureFlagProvider = new LocalFeatureFlagProvider(config.localFlags);
      break;
    default:
      throw new Error(`Unknown feature flag provider: ${config.provider}`);
  }

  featureFlagsLogger.info(
    { provider: config.provider },
    "Feature flags initialized",
  );
  return featureFlagProvider;
}

/**
 * Checks if a feature flag is enabled for the given context.
 * Returns false if feature flags are not initialized.
 *
 * @param flagName - The name of the feature flag to check
 * @param context - Context information for evaluating the flag (defaults to empty object)
 * @returns Promise resolving to true if the flag is enabled, false otherwise
 */
export async function isFeatureEnabled(
  flagName: string,
  context: FeatureFlagContext = {},
): Promise<boolean> {
  if (!featureFlagProvider) {
    featureFlagsLogger.warn(
      "Feature flags not initialized, returning false for all flags",
    );
    return false;
  }

  return featureFlagProvider.isEnabled(flagName, context);
}

/**
 * Gets the value of a feature flag for the given context.
 * Returns null if feature flags are not initialized.
 *
 * @param flagName - The name of the feature flag to retrieve
 * @param context - Context information for evaluating the flag (defaults to empty object)
 * @returns Promise resolving to the flag value, or null if not found or not initialized
 */
export async function getFeatureFlag(
  flagName: string,
  context: FeatureFlagContext = {},
): Promise<string | boolean | number | null> {
  if (!featureFlagProvider) {
    featureFlagsLogger.warn("Feature flags not initialized, returning null");
    return null;
  }

  return featureFlagProvider.getFeatureFlag(flagName, context);
}

/**
 * Shuts down the feature flag provider and performs cleanup.
 * This should be called when the application is shutting down.
 * Subsequent calls to feature flag functions will behave as if not initialized.
 *
 * @returns Promise that resolves when shutdown is complete
 */
export async function shutdownFeatureFlags(): Promise<void> {
  if (featureFlagProvider) {
    try {
      await featureFlagProvider.shutdown();
    } catch (error) {
      featureFlagsLogger.warn(
        { error },
        "Error during shutdown, continuing anyway",
      );
    }
    featureFlagProvider = null;
  }
}

/**
 * Gets the current feature flag provider instance.
 * Returns null if feature flags have not been initialized.
 *
 * @returns The current feature flag provider or null
 */
export function getFeatureFlagProvider(): FeatureFlagProvider | null {
  return featureFlagProvider;
}

// Re-export types for convenience
export * from "./types";
