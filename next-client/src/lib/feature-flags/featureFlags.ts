"use client";

import posthog from "posthog-js";
import type {
  FeatureFlagContext,
  FeatureFlagProvider,
} from "tttc-common/feature-flags";

/**
 * Client-side feature flag implementation for Next.js.
 * Supports both local flags and PostHog integration using posthog-js.
 */

/**
 * Environment configuration for Next.js feature flags.
 */
export interface NextFeatureFlagEnv {
  NEXT_PUBLIC_FEATURE_FLAG_PROVIDER?: "local" | "posthog";
  NEXT_PUBLIC_FEATURE_FLAG_API_KEY?: string;
  NEXT_PUBLIC_FEATURE_FLAG_HOST?: string;
  NEXT_PUBLIC_LOCAL_FLAGS?: string;
}

/**
 * PostHog browser provider for client-side feature flags.
 */
class PostHogBrowserProvider implements FeatureFlagProvider {
  constructor(apiKey: string, host?: string) {
    if (typeof window !== "undefined" && !posthog.__loaded) {
      posthog.init(apiKey, {
        api_host: host || "https://app.posthog.com",
        loaded: (_posthog) => {
          // PostHog is ready
        },
      });
    }
  }

  async isEnabled(
    flagName: string,
    context: FeatureFlagContext,
  ): Promise<boolean> {
    if (context.userId) {
      posthog.identify(context.userId, context.properties);
    }
    return posthog.isFeatureEnabled(flagName) || false;
  }

  async getFeatureFlag(
    flagName: string,
    context: FeatureFlagContext,
  ): Promise<string | boolean | number | null> {
    if (context.userId) {
      posthog.identify(context.userId, context.properties);
    }
    const value = posthog.getFeatureFlag(flagName);
    return value === undefined ? null : value;
  }

  async shutdown(): Promise<void> {
    if (typeof window !== "undefined") {
      posthog.reset();
    }
  }
}

/**
 * Local provider for client-side feature flags.
 */
class LocalBrowserProvider implements FeatureFlagProvider {
  private flags: Record<string, boolean | string | number>;

  constructor(flags: Record<string, boolean | string | number> = {}) {
    this.flags = flags;
  }

  async isEnabled(
    flagName: string,
    _context: FeatureFlagContext,
  ): Promise<boolean> {
    const flag = this.flags[flagName];
    return Boolean(flag);
  }

  async getFeatureFlag(
    flagName: string,
    _context: FeatureFlagContext,
  ): Promise<string | boolean | number | null> {
    return this.flags[flagName] ?? null;
  }

  async shutdown(): Promise<void> {
    // No cleanup needed
  }
}

let provider: FeatureFlagProvider | null = null;

/**
 * Initializes feature flags for Next.js client-side.
 * Supports both local and PostHog providers.
 *
 * @param env - Next.js environment configuration
 * @returns The initialized feature flag provider
 */
export function initializeFeatureFlags(
  env: Partial<NextFeatureFlagEnv> = {},
): FeatureFlagProvider {
  if (provider) {
    return provider;
  }

  const envVars = {
    NEXT_PUBLIC_FEATURE_FLAG_PROVIDER:
      env.NEXT_PUBLIC_FEATURE_FLAG_PROVIDER ||
      (typeof window !== "undefined"
        ? undefined
        : process.env.NEXT_PUBLIC_FEATURE_FLAG_PROVIDER),
    NEXT_PUBLIC_FEATURE_FLAG_API_KEY:
      env.NEXT_PUBLIC_FEATURE_FLAG_API_KEY ||
      (typeof window !== "undefined"
        ? undefined
        : process.env.NEXT_PUBLIC_FEATURE_FLAG_API_KEY),
    NEXT_PUBLIC_FEATURE_FLAG_HOST:
      env.NEXT_PUBLIC_FEATURE_FLAG_HOST ||
      (typeof window !== "undefined"
        ? undefined
        : process.env.NEXT_PUBLIC_FEATURE_FLAG_HOST),
    NEXT_PUBLIC_LOCAL_FLAGS:
      env.NEXT_PUBLIC_LOCAL_FLAGS ||
      (typeof window !== "undefined"
        ? undefined
        : process.env.NEXT_PUBLIC_LOCAL_FLAGS),
  };

  const providerType = envVars.NEXT_PUBLIC_FEATURE_FLAG_PROVIDER || "local";

  if (providerType === "posthog") {
    const apiKey = envVars.NEXT_PUBLIC_FEATURE_FLAG_API_KEY;
    if (!apiKey) {
      throw new Error(
        "NEXT_PUBLIC_FEATURE_FLAG_API_KEY is required for PostHog provider",
      );
    }
    provider = new PostHogBrowserProvider(
      apiKey,
      envVars.NEXT_PUBLIC_FEATURE_FLAG_HOST,
    );
  } else {
    let localFlags: Record<string, boolean | string | number> = {};
    const flagsStr = envVars.NEXT_PUBLIC_LOCAL_FLAGS;

    if (flagsStr) {
      try {
        localFlags = JSON.parse(flagsStr);
      } catch (error) {
        console.error("Failed to parse NEXT_PUBLIC_LOCAL_FLAGS:", error);
      }
    }

    provider = new LocalBrowserProvider(localFlags);
  }

  return provider;
}

/**
 * Checks if a feature flag is enabled.
 *
 * @param flagName - The name of the feature flag to check
 * @param context - Context information for evaluating the flag
 * @returns Promise resolving to true if enabled, false otherwise
 */
export async function isFeatureEnabled(
  flagName: string,
  context: FeatureFlagContext = {},
): Promise<boolean> {
  if (!provider) {
    initializeFeatureFlags();
  }
  return provider?.isEnabled(flagName, context) ?? false;
}

/**
 * Gets the value of a feature flag.
 *
 * @param flagName - The name of the feature flag to retrieve
 * @param context - Context information for evaluating the flag
 * @returns Promise resolving to the flag value, or null if not found
 */
export async function getFeatureFlag(
  flagName: string,
  context: FeatureFlagContext = {},
): Promise<string | boolean | number | null> {
  if (!provider) {
    initializeFeatureFlags();
  }
  return provider?.getFeatureFlag(flagName, context) ?? null;
}

/**
 * Shuts down the feature flag provider.
 *
 * @returns Promise that resolves when shutdown is complete
 */
export async function shutdownFeatureFlags(): Promise<void> {
  if (provider) {
    await provider.shutdown();
    provider = null;
  }
}

/**
 * Gets the current feature flag provider.
 *
 * @returns The current provider or null
 */
export function getFeatureFlagProvider(): FeatureFlagProvider | null {
  return provider;
}

export type { FeatureFlagProvider, FeatureFlagContext };
