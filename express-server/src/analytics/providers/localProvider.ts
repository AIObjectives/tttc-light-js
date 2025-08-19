import {
  AnalyticsProvider,
  AnalyticsEvent,
  AnalyticsIdentify,
  AnalyticsContext,
  AnalyticsProperties,
} from '../types';
import { logger } from "tttc-common/logger";

/**
 * Configuration for local analytics provider
 */
export interface LocalAnalyticsConfig {
  debug?: boolean;
  enabled?: boolean;
}

/**
 * Local analytics provider implementation
 * Logs analytics events to console and optionally to structured logs
 * Useful for development, testing, and environments where external analytics are not desired
 */
export class LocalAnalyticsProvider implements AnalyticsProvider {
  private debug: boolean;
  private enabled: boolean;

  /**
   * Creates a new local analytics provider
   * @param config - Configuration options
   */
  constructor(config: LocalAnalyticsConfig = {}) {
    this.debug = config.debug ?? true;
    this.enabled = config.enabled ?? true;

    if (this.debug && this.enabled) {
      console.log('[ANALYTICS:LOCAL] Local analytics provider initialized');
    }
  }

  /**
   * Tracks an analytics event by logging to console
   * @param event - The event to track
   */
  async track(event: AnalyticsEvent): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const eventData = {
        name: event.name,
        properties: event.properties,
        context: {
          ...event.context,
          timestamp: event.context?.timestamp || new Date(),
        },
      };

      if (this.debug) {
        console.log('[ANALYTICS:LOCAL] Event tracked:');
        console.log(eventData);
      } else {
        // Non-debug mode: simpler logging
        console.log(`[ANALYTICS:LOCAL] Event: ${event.name}`);
      }

      // Also log through structured logger for production scenarios
      logger.info('LOCAL ANALYTICS: Event tracked', {
        eventName: event.name,
        userId: event.context?.user?.userId,
        sessionId: event.context?.sessionId,
      });
    } catch (error) {
      // Handle logging errors gracefully
      logger.error('LOCAL ANALYTICS ERROR: Failed to track event:', error);
    }
  }

  /**
   * Identifies a user by logging identification data
   * @param identify - User identification data
   */
  async identify(identify: AnalyticsIdentify): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const identifyData = {
        userId: identify.userId,
        traits: identify.traits,
        context: {
          ...identify.context,
          timestamp: identify.context?.timestamp || new Date(),
        },
      };

      if (this.debug) {
        console.log('[ANALYTICS:LOCAL] User identified:');
        console.log(identifyData);
      } else {
        console.log(`[ANALYTICS:LOCAL] User identified: ${identify.userId}`);
      }

      // Log through structured logger
      logger.info('LOCAL ANALYTICS: User identified', {
        userId: identify.userId,
        hasTraits: !!identify.traits,
        traitsCount: identify.traits ? Object.keys(identify.traits).length : 0,
      });
    } catch (error) {
      logger.error('LOCAL ANALYTICS ERROR: Failed to identify user:', error);
    }
  }

  /**
   * Tracks a page view by logging page data
   * @param name - Page or screen name
   * @param properties - Additional properties
   * @param context - Analytics context
   */
  async page(name: string, properties?: AnalyticsProperties, context?: AnalyticsContext): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const pageData = {
        page: name,
        properties,
        context: {
          ...context,
          timestamp: context?.timestamp || new Date(),
        },
      };

      if (this.debug) {
        console.log('[ANALYTICS:LOCAL] Page tracked:');
        console.log(pageData);
      } else {
        console.log(`[ANALYTICS:LOCAL] Page: ${name}`);
      }

      // Log through structured logger
      logger.info('LOCAL ANALYTICS: Page tracked', {
        pageName: name,
        userId: context?.user?.userId,
        sessionId: context?.sessionId,
      });
    } catch (error) {
      logger.error('LOCAL ANALYTICS ERROR: Failed to track page:', error);
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
        console.log('[ANALYTICS:LOCAL] Flush requested - all events are already processed');
      }

      logger.info('LOCAL ANALYTICS: Flush requested');
    } catch (error) {
      logger.error('LOCAL ANALYTICS ERROR: Failed to flush:', error);
    }
  }

  /**
   * Handles shutdown by logging the shutdown
   */
  async shutdown(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      if (this.debug) {
        console.log('[ANALYTICS:LOCAL] Analytics shutdown - cleaning up local provider');
      }

      logger.info('LOCAL ANALYTICS: Analytics shutdown');
    } catch (error) {
      logger.error('LOCAL ANALYTICS ERROR: Failed to shutdown:', error);
    }
  }
}