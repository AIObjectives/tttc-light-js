import { PostHog } from "posthog-node";
import { FeatureFlagProvider, FeatureFlagContext } from "../types";
import { logger } from "../../logger";

const posthogLogger = logger.child({ module: "feature-flags-posthog" });

/**
 * PostHog implementation of feature flag provider.
 * Integrates with PostHog's feature flag service for dynamic flag evaluation.
 */
export class PostHogFeatureFlagProvider implements FeatureFlagProvider {
  private posthog: PostHog;

  /**
   * Creates a new PostHogFeatureFlagProvider instance.
   *
   * @param apiKey - PostHog API key for authentication
   * @param host - PostHog host URL (defaults to https://app.posthog.com)
   */
  constructor(apiKey: string, host = "https://app.posthog.com") {
    this.posthog = new PostHog(apiKey, {
      host,
      flushAt: 20,
      flushInterval: 10000,
    });
  }

  /**
   * Checks if a feature flag is enabled via PostHog.
   * Returns false if an error occurs during evaluation.
   *
   * @param flagName - The name of the feature flag to check
   * @param context - Context information for evaluating the flag
   * @returns Promise resolving to true if the flag is enabled, false otherwise
   */
  async isEnabled(
    flagName: string,
    context: FeatureFlagContext,
  ): Promise<boolean> {
    try {
      const result = await this.posthog.isFeatureEnabled(
        flagName,
        context.userId || "anonymous",
        {
          groups: context.groups,
          personProperties: context.properties,
        },
      );
      return Boolean(result);
    } catch (error) {
      posthogLogger.error(
        {
          error,
          flagName,
        },
        "Error checking feature flag",
      );
      return false;
    }
  }

  /**
   * Gets the value of a feature flag via PostHog.
   * Supports boolean and string values.
   * Returns null if an error occurs or if the value type is invalid.
   *
   * @param flagName - The name of the feature flag to retrieve
   * @param context - Context information for evaluating the flag
   * @returns Promise resolving to the flag value, or null if not found or invalid
   */
  async getFeatureFlag(
    flagName: string,
    context: FeatureFlagContext,
  ): Promise<string | boolean | null> {
    try {
      const result = await this.posthog.getFeatureFlag(
        flagName,
        context.userId || "anonymous",
        {
          groups: context.groups,
          personProperties: context.properties,
        },
      );
      if (result === null || result === undefined) {
        posthogLogger.info({ flagName }, "Flag returned null value");
        return null;
      }
      switch (typeof result) {
        case "boolean":
        case "string":
          return result;
        default:
          posthogLogger.error(
            {
              flagName,
              resultType: typeof result,
            },
            "Invalid type returned when fetching feature flag",
          );
          return null;
      }
    } catch (error) {
      posthogLogger.error(
        {
          error,
          flagName,
        },
        "Error getting feature flag",
      );
      return null;
    }
  }

  /**
   * Shuts down the PostHog client and flushes any pending events.
   *
   * @returns Promise that resolves when shutdown is complete
   */
  async shutdown(): Promise<void> {
    await this.posthog.shutdown();
  }
}
