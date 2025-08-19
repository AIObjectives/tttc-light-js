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

  /**
   * Creates a new local analytics provider
   */
  constructor(config: { enabled?: boolean } = {}) {
    this.enabled = config.enabled!!;
  }

  /**
   * Tracks an analytics event by logging events
   */
  async track(event: AnalyticsEvent): Promise<void> {
    if (!this.enabled) {
      return;
    }

    logger.info(`LOCAL ANALYTICS: Event tracked:  
	{
          eventName: ${event.name},
          userId: ${event.context?.user?.userId},
          sessionId: ${event.context?.sessionId},
          platform: ${event.context?.platform},
          hasProperties: ${!!event.properties},
          propertiesCount: ${event.properties ? Object.keys(event.properties).length : 0},
  	}`);
  }

  /**
   * Identifies a user by logging identification data
   */
  async identify(identify: AnalyticsIdentify): Promise<void> {
    if (!this.enabled) {
      return;
    }

    logger.info(`LOCAL ANALYTICS: User identified:  
	{
          userId: ${identify.userId},
          hasTraits: ${!!identify.traits},
          traitsCount: ${identify.traits ? Object.keys(identify.traits).length : 0},
          sessionId: ${identify.context?.sessionId},
          platform: ${identify.context?.platform},
  	}`);
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

    logger.info(`LOCAL ANALYTICS: Page tracked:  
	{
          pageName: ${name},
          userId: ${context?.user?.userId},
          sessionId: ${context?.sessionId},
          platform: ${context?.platform},
          url: ${context?.url},
          hasProperties: ${!!properties},
          propertiesCount: ${properties ? Object.keys(properties).length : 0},
  	}`);
  }

  /**
   * Handles flush by logging the flush request
   */
  async flush(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    logger.info("LOCAL ANALYTICS: Flush requested");
  }

  /**
   * Handles shutdown by logging the shutdown
   */
  async shutdown(): Promise<void> {
    logger.info(`LOCAL ANALYTICS: Analytics shutdown`);
    this.ready = false;
  }

  /**
   * Checks if the provider is ready
   */
  isReady(): boolean {
    return this.ready;
  }
}
