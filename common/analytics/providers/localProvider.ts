import { logger } from "../../logger";
import type {
  AnalyticsContext,
  AnalyticsEvent,
  AnalyticsIdentify,
  AnalyticsProperties,
  AnalyticsProvider,
} from "../types";

const localLogger = logger.child({ module: "analytics-local" });

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
      localLogger.info(
        {
          eventName: event.name,
          userId: event.context?.user?.userId,
          sessionId: event.context?.sessionId,
          platform: event.context?.platform,
          hasProperties: !!event.properties,
          propertiesCount: event.properties
            ? Object.keys(event.properties).length
            : 0,
        },
        "Event tracked",
      );
    } catch (_error) {
      // Silently handle logging errors to prevent disrupting analytics flow
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
      localLogger.info(
        {
          userId: identify.userId,
          hasTraits: !!identify.traits,
          traitsCount: identify.traits
            ? Object.keys(identify.traits).length
            : 0,
          sessionId: identify.context?.sessionId,
          platform: identify.context?.platform,
        },
        "User identified",
      );
    } catch (_error) {
      // Silently handle logging errors to prevent disrupting analytics flow
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
      localLogger.info(
        {
          pageName: name,
          userId: context?.user?.userId,
          sessionId: context?.sessionId,
          platform: context?.platform,
          url: context?.url,
          hasProperties: !!properties,
          propertiesCount: properties ? Object.keys(properties).length : 0,
        },
        "Page tracked",
      );
    } catch (_error) {
      // Silently handle logging errors to prevent disrupting analytics flow
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
      localLogger.info({}, "Flush requested");
    } catch (_error) {
      // Silently handle logging errors to prevent disrupting analytics flow
    }
  }

  /**
   * Handles shutdown by logging the shutdown
   */
  async shutdown(): Promise<void> {
    try {
      localLogger.info({}, "Analytics shutdown");
    } catch (_error) {
      // Silently handle logging errors to prevent disrupting analytics flow
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
