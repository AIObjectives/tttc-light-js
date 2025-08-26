import { PostHog } from "posthog-node";
import { FeatureFlagProvider, FeatureFlagContext } from "../types";
import { logger } from "tttc-common/logger";

const posthogLogger = logger.child({ module: "feature-flags-posthog" });

export class PostHogFeatureFlagProvider implements FeatureFlagProvider {
  private posthog: PostHog;

  constructor(apiKey: string, host = "https://app.posthog.com") {
    this.posthog = new PostHog(apiKey, {
      host,
      flushAt: 20,
      flushInterval: 10000,
    });
  }

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

  async getAllFlags(
    context: FeatureFlagContext,
  ): Promise<Record<string, string | boolean>> {
    try {
      const result = await this.posthog.getAllFlags(
        context.userId || "anonymous",
        {
          groups: context.groups,
          personProperties: context.properties,
        },
      );
      return result || {};
    } catch (error) {
      posthogLogger.error({ error }, "Error getting all feature flags");
      return {};
    }
  }

  async shutdown(): Promise<void> {
    await this.posthog.shutdown();
  }
}
