import type {
  AnalyticsClient,
  AnalyticsConfig,
  AnalyticsEvent,
  AnalyticsIdentify,
  AnalyticsContext,
  AnalyticsProperties,
  AnalyticsProvider,
  EnvironmentInfo,
} from "./types";
import { LocalAnalyticsProvider } from "./providers/localProvider";
import { PostHogAnalyticsProvider } from "./providers/posthogProvider";
import {
  getEnvironmentInfo,
  generateSessionId,
  generateRequestId,
  getAppVersion,
  getEnvironmentName,
} from "./environment";
import { logger } from "../logger";

/**
 * Main analytics client that works in both browser and server environments
 * Manages provider initialization and provides a consistent interface for analytics tracking
 */
export class Analytics implements AnalyticsClient {
  private provider: AnalyticsProvider | null = null;
  private config: AnalyticsConfig | null = null;
  private sessionId: string;

  constructor() {
    this.sessionId = generateSessionId();
  }

  /**
   * Initializes the analytics system with the specified configuration
   * @throws Error if provider initialization fails
   */
  async initialize(config: AnalyticsConfig): Promise<void> {
    // Prevent re-initialization if already initialized
    if (this.isInitialized()) {
      logger.warn(
        "[ANALYTICS] Already initialized, skipping re-initialization",
      );
      return;
    }

    // Store configuration
    this.config = config;

    // Check if analytics is disabled
    if (config.enabled === false) {
      logger.info("[ANALYTICS]: Disabled by configuration");
      this.provider = new LocalAnalyticsProvider({ enabled: false });
      return;
    }

    try {
      // Create provider based on configuration and environment
      this.provider = await this.createProvider(config);

      // Ensure the provider is ready (trigger initialization for lazy providers)
      if (typeof (this.provider as any).ensureInitialized === "function") {
        await (this.provider as any).ensureInitialized();
      }

      const environmentInfo = getEnvironmentInfo();
      logger.info(
        "[ANALYTICS]: Initialized %s provider (platform=%s env=%s)",
        config.provider?.toString()!,
        environmentInfo.platform,
        config.environment || getEnvironmentName(),
      );
    } catch (error) {
      logger.error(
        error,
        "[ANALYTICS]: Failed to initialize provider, falling back to local provider",
      );

      // Fallback to local provider on initialization failure
      this.provider = new LocalAnalyticsProvider({
        enabled: true,
      });
    }
  }

  /**
   * Tracks an analytics event using the configured provider
   *
   * Usage example:
   * ```typescript
   * await analytics.track({
   *   name: CommonEvents.USER_SIGNIN,
   *   properties: {
   *     method: 'firebase',
   *     provider: 'google',
   *   },
   *   context: {
   *     user: { userId: 'user123', email: 'user@example.com' },
   *   },
   * });
   * ```
   */
  async track(event: AnalyticsEvent): Promise<void> {
    if (!this.provider) {
      logger.warn(
        "[ANALYTICS]: Provider not initialized, skipping event tracking",
      );
      return;
    }

    try {
      // Enhance event with default context
      const enhancedEvent = this.enhanceEvent(event);
      await this.provider.track(enhancedEvent);
    } catch (error) {
      logger.error(error, `[ANALYTICS]: Failed to track event %s`, event.name);
    }
  }

  /**
   * Identifies a user for analytics tracking
   *
   * Usage example:
   * ```typescript
   * await analytics.identify({
   *   userId: 'user123',
   *   traits: {
   *     name: 'John Doe',
   *     email: 'john@example.com',
   *     plan: 'premium',
   *   },
   * });
   * ```
   */
  async identify(identify: AnalyticsIdentify): Promise<void> {
    if (!this.provider) {
      logger.warn(
        "[ANALYTICS]: Provider not initialized, skipping user identification",
      );
      return;
    }

    try {
      // Enhance identify with default context
      const enhancedIdentify = this.enhanceIdentify(identify);
      await this.provider.identify(enhancedIdentify);
    } catch (error) {
      logger.error(
        error,
        `[ANALYTICS]: Failed to identify user %s`,
        identify.userId,
      );
    }
  }

  /**
   * Tracks a page view or screen view
   *
   * Usage example:
   * ```typescript
   * await analytics.page('Dashboard', {
   *   section: 'reports',
   *   reportId: 'report123',
   * });
   * ```
   */
  async page(
    name: string,
    properties?: AnalyticsProperties,
    context?: AnalyticsContext,
  ): Promise<void> {
    if (!this.provider) {
      logger.warn(
        "[ANALYTICS]: Provider not initialized, skipping page tracking",
      );
      return;
    }

    try {
      // Enhance context with defaults
      const enhancedContext = this.enhanceContext(context);
      await this.provider.page(name, properties, enhancedContext);
    } catch (error) {
      logger.error(error, `[ANALYTICS]: Failed to track page %s`, name);
    }
  }

  /**
   * Flushes any pending analytics data
   *
   * Usage example:
   * ```typescript
   * // Before app shutdown
   * await analytics.flush();
   * ```
   */
  async flush(): Promise<void> {
    if (!this.provider) {
      return;
    }

    try {
      await this.provider.flush();
      logger.debug("[ANALYTICS]: Successfully flushed analytics data");
    } catch (error) {
      logger.error(error, "[ANALYTICS]: Failed to flush analytics data");
    }
  }

  /**
   * Shuts down the analytics system and cleans up resources
   *
   * Usage example:
   * ```typescript
   * // During app shutdown
   * await analytics.shutdown();
   * ```
   */
  async shutdown(): Promise<void> {
    if (!this.provider) {
      return;
    }

    try {
      await this.provider.shutdown();
      logger.info("[ANALYTICS]: Successfully shut down analytics provider");
      this.provider = null;
    } catch (error) {
      logger.error(error, "[ANALYTICS]: Failed to shutdown analytics provider");
    }
  }

  /**
   * Checks if analytics is initialized
   */
  isInitialized(): boolean {
    return this.provider !== null && this.provider.isReady();
  }

  /**
   * Gets environment information
   */
  getEnvironmentInfo(): EnvironmentInfo {
    return getEnvironmentInfo();
  }

  /**
   * Helper function to create analytics context from common data
   */
  createContext(
    userId?: string,
    email?: string,
    additionalProperties?: AnalyticsProperties,
    requestId?: string,
  ): AnalyticsContext {
    const environmentInfo = getEnvironmentInfo();
    return this.enhanceContext({
      user:
        userId || email
          ? {
              userId,
              email,
              properties: additionalProperties,
            }
          : undefined,
      requestId:
        requestId ||
        (environmentInfo.platform === "server"
          ? generateRequestId()
          : undefined),
    });
  }

  /**
   * Creates the appropriate provider based on configuration and environment
   */
  private async createProvider(
    config: AnalyticsConfig,
  ): Promise<AnalyticsProvider> {
    const environmentInfo = getEnvironmentInfo();

    switch (config.provider) {
      case "local":
        return new LocalAnalyticsProvider({
          enabled: config.enabled,
        });

      case "posthog":
        // For PostHog, we only support server-side implementation
        if (environmentInfo.platform === "browser") {
          logger.warn(
            "[ANALYTICS]: PostHog browser provider not available, falling back to local provider",
          );
          return new LocalAnalyticsProvider({
            enabled: config.enabled,
          });
        } else {
          return new PostHogAnalyticsProvider(config);
        }

      default:
        throw new Error(`Unknown analytics provider: ${config.provider}`);
    }
  }

  /**
   * Enhances an event with default context
   */
  private enhanceEvent(event: AnalyticsEvent): AnalyticsEvent {
    return {
      ...event,
      context: this.enhanceContext(event.context),
    };
  }

  /**
   * Enhances identify data with default context
   */
  private enhanceIdentify(identify: AnalyticsIdentify): AnalyticsIdentify {
    return {
      ...identify,
      context: this.enhanceContext(identify.context),
    };
  }

  /**
   * Enhances context with default values
   */
  private enhanceContext(context?: AnalyticsContext): AnalyticsContext {
    const environmentInfo = getEnvironmentInfo();
    return {
      sessionId: this.sessionId,
      timestamp: new Date(),
      environment: this.config?.environment || getEnvironmentName(),
      version: this.config?.version || getAppVersion(),
      platform: environmentInfo.platform,
      url: environmentInfo.url,
      userAgent: environmentInfo.userAgent,
      ...context,
    };
  }
}

/**
 * Global analytics instance
 */
let globalAnalytics: Analytics | null = null;

/**
 * Gets or creates the global analytics instance
 */
export function getAnalytics(): Analytics {
  if (!globalAnalytics) {
    globalAnalytics = new Analytics();
  }
  return globalAnalytics;
}

/**
 * Resets the global analytics instance (for testing purposes)
 * @internal
 */
export function resetGlobalAnalytics(): void {
  globalAnalytics = null;
}

/**
 * Convenience function to initialize analytics
 */
export async function initializeAnalytics(
  config: AnalyticsConfig,
): Promise<void> {
  const analytics = getAnalytics();
  await analytics.initialize(config);
}

/**
 * Convenience function to track an event
 */
export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  const analytics = getAnalytics();
  await analytics.track(event);
}

/**
 * Convenience function to identify a user
 */
export async function identifyUser(identify: AnalyticsIdentify): Promise<void> {
  const analytics = getAnalytics();
  await analytics.identify(identify);
}

/**
 * Convenience function to track a page view
 */
export async function trackPage(
  name: string,
  properties?: AnalyticsProperties,
  context?: AnalyticsContext,
): Promise<void> {
  const analytics = getAnalytics();
  await analytics.page(name, properties, context);
}
