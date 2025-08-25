import type {
  AnalyticsProvider,
  AnalyticsEvent,
  AnalyticsIdentify,
  AnalyticsContext,
  AnalyticsProperties,
} from "../types";
import { logger } from "../../logger";

/**
 * Local analytics provider implementation
 * Logs analytics events to console and optionally to structured logs
 * Useful for development, testing, and environments where external analytics are not desired
 */
export class LocalAnalyticsProvider implements AnalyticsProvider {
  private enabled: boolean;
  private ready: boolean = true;
  private debug: boolean;

  /**
   * Creates a new local analytics provider
   */
  constructor(config: { enabled?: boolean; debug?: boolean } = {}) {
    this.enabled = config.enabled !== false;
    this.debug = config.debug || false;
  }

  /**
   * Tracks an analytics event by logging events
   */
  async track(event: AnalyticsEvent): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      if (this.debug) {
        logger.info(`LOCAL ANALYTICS: Event tracked: {
          eventName: ${event.name},
          userId: ${event.context?.user?.userId},
          sessionId: ${event.context?.sessionId},
          platform: ${event.context?.platform},
          hasProperties: ${!!event.properties},
          propertiesCount: ${event.properties ? Object.keys(event.properties).length : 0}
        }`);
      } else {
        logger.info(`LOCAL ANALYTICS: Event tracked: ${event.name}`);
      }
    } catch (error) {
      // Silently fail to not disrupt application flow
    }
  }

  /**
   * Identifies a user by logging identification data
   */
  async identify(identify: AnalyticsIdentify): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      if (this.debug) {
        logger.info(`LOCAL ANALYTICS: User identified: {
          userId: ${identify.userId},
          hasTraits: ${!!identify.traits},
          traitsCount: ${identify.traits ? Object.keys(identify.traits).length : 0},
          sessionId: ${identify.context?.sessionId},
          platform: ${identify.context?.platform}
        }`);
      } else {
        logger.info(`LOCAL ANALYTICS: User identified: ${identify.userId}`);
      }
    } catch (error) {
      // Silently fail to not disrupt application flow
    }
  }

  /**
   * Tracks a page view by logging page data
   */
  async page(
    name: string,
    properties?: AnalyticsProperties,
    context?: AnalyticsContext,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      if (this.debug) {
        logger.info(`LOCAL ANALYTICS: Page tracked: {
          pageName: ${name},
          userId: ${context?.user?.userId},
          sessionId: ${context?.sessionId},
          platform: ${context?.platform},
          url: ${context?.url},
          hasProperties: ${!!properties},
          propertiesCount: ${properties ? Object.keys(properties).length : 0}
        }`);
      } else {
        logger.info(`LOCAL ANALYTICS: Page tracked: ${name}`);
      }
    } catch (error) {
      // Silently fail to not disrupt application flow
    }
  }

  /**
   * Handles flush by logging the flush request
   */
  async flush(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      if (this.debug) {
        logger.info(
          "LOCAL ANALYTICS: Flush requested: { timestamp: " +
            new Date().toISOString() +
            " }",
        );
      } else {
        logger.info("LOCAL ANALYTICS: Flush requested");
      }
    } catch (error) {
      // Silently fail to not disrupt application flow
    }
  }

  /**
   * Handles shutdown by logging the shutdown
   */
  async shutdown(): Promise<void> {
    try {
      if (this.debug) {
        logger.info(
          "LOCAL ANALYTICS: Analytics shutdown: { timestamp: " +
            new Date().toISOString() +
            " }",
        );
      } else {
        logger.info("LOCAL ANALYTICS: Analytics shutdown");
      }
    } catch (error) {
      // Silently fail to not disrupt application flow
    }
    this.ready = false;
  }

  /**
   * Checks if the provider is ready
   */
  isReady(): boolean {
    return this.ready;
  }
}
