/**
 * Express Server Analytics Client
 *
 * This module provides a wrapper around the common analytics package
 * for server-side usage, handling initialization and error handling
 * specific to the express server environment.
 */

import {
  initializeAnalytics,
  getAnalytics,
  createAnalyticsConfig,
  AnalyticsConfig,
} from "tttc-common/analytics";
import { Env } from "./types/context";
import { logger } from "tttc-common/logger";

/**
 * Initializes analytics for the express server
 * @param env - Environment configuration object
 */
export async function initializeAnalyticsClient(env: Env): Promise<void> {
  try {
    logger.info("ANALYTICS: Starting analytics client initialization", {
      provider: env.ANALYTICS_PROVIDER,
      enabled: env.ANALYTICS_ENABLED,
    });

    // Create analytics configuration from environment
    const config: AnalyticsConfig = createAnalyticsConfig(
      env.ANALYTICS_PROVIDER as "posthog" | "local",
      env.ANALYTICS_API_KEY,
      {
        host: env.ANALYTICS_HOST,
        enabled: env.ANALYTICS_ENABLED,
        flushAt: env.ANALYTICS_FLUSH_AT,
        flushInterval: env.ANALYTICS_FLUSH_INTERVAL,
      },
    );

    // Initialize analytics
    await initializeAnalytics(config);

    logger.info("ANALYTICS: Analytics client initialized successfully", {
      provider: env.ANALYTICS_PROVIDER,
      enabled: env.ANALYTICS_ENABLED,
    });
  } catch (error) {
    // Log error but don't throw - analytics should not block server startup
    logger.error("ANALYTICS: Failed to initialize analytics client", error);
  }
}

/**
 * Shuts down analytics gracefully during server shutdown
 */
export async function shutdownAnalyticsClient(): Promise<void> {
  try {
    const analytics = getAnalytics();

    if (!analytics.isInitialized()) {
      logger.info("ANALYTICS: No analytics client to shutdown");
      return;
    }

    logger.info("ANALYTICS: Starting analytics client shutdown");

    // Shutdown analytics
    await analytics.shutdown();

    logger.info("ANALYTICS: Analytics client shutdown completed");
  } catch (error) {
    logger.error("ANALYTICS: Unexpected error during shutdown", error);
  }
}

/**
 * Checks if analytics client is initialized
 */
export function isAnalyticsClientInitialized(): boolean {
  try {
    return getAnalytics().isInitialized();
  } catch {
    return false;
  }
}

/**
 * Gets the analytics client instance
 * @returns Analytics client instance or null if not initialized
 */
export function getAnalyticsClient() {
  try {
    const analytics = getAnalytics();
    return analytics.isInitialized() ? analytics : null;
  } catch {
    return null;
  }
}
