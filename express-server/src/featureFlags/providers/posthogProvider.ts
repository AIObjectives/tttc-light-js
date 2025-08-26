import { PostHog } from "posthog-node";
import { FeatureFlagProvider, FeatureFlagContext } from "../types";
import { logger } from "tttc-common/logger";

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
      logger.error(
        error,
        `[POSTHOG] Error checking feature flag %s:`,
        flagName,
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
        logger.info(`POSTHOG INFO: flag %s returned a null value`, flagName);
        return null;
      }
      switch (typeof result) {
        case "boolean":
        case "string":
          return result;
        default:
          logger.error(
            `[POSTHOG] Invalid type returned when fetching feature flag feature flag: %s`,
            flagName,
          );
          return null;
      }
    } catch (error) {
      logger.error(error, `[POSTHOG] Error getting feature flag %s:`, flagName);
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
      logger.error(error, "[POSTHOG] Error getting all feature flags");
      return {};
    }
  }

  async shutdown(): Promise<void> {
    await this.posthog.shutdown();
  }
}
