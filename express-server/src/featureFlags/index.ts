import { FeatureFlagProvider, FeatureFlagContext } from "./types";
import { LocalFeatureFlagProvider } from "./providers/localProvider";
import { PostHogFeatureFlagProvider } from "./providers/posthogProvider";
import { logger } from "tttc-common/logger";
import { Env } from "../types/context";

const featureFlagsLogger = logger.child({ module: "feature-flags" });

let featureFlagProvider: FeatureFlagProvider | null = null;

export function initializeFeatureFlags(env: Env): FeatureFlagProvider {
  if (featureFlagProvider) {
    return featureFlagProvider;
  }

  const provider = env.FEATURE_FLAG_PROVIDER || "local";

  switch (provider) {
    case "posthog":
      if (!env.FEATURE_FLAG_API_KEY) {
        throw new Error("PostHog API key is required for PostHog provider");
      }
      featureFlagProvider = new PostHogFeatureFlagProvider(
        env.FEATURE_FLAG_API_KEY,
        env.FEATURE_FLAG_HOST,
      );
      break;
    case "local":
      featureFlagProvider = new LocalFeatureFlagProvider(env.LOCAL_FLAGS);
      break;
    default:
      throw new Error(`Unknown feature flag provider: ${provider}`);
  }

  featureFlagsLogger.info(
    { provider: provider.toString() },
    "Feature flags initialized",
  );
  return featureFlagProvider!;
}

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

export async function getAllFeatureFlags(
  context: FeatureFlagContext = {},
): Promise<Record<string, string | boolean | number>> {
  if (!featureFlagProvider) {
    featureFlagsLogger.warn(
      "Feature flags not initialized, returning empty object",
    );
    return {};
  }

  return featureFlagProvider.getAllFlags(context);
}

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

export function getFeatureFlagProvider(): FeatureFlagProvider | null {
  return featureFlagProvider;
}

// Re-export types for convenience
export * from "./types";
