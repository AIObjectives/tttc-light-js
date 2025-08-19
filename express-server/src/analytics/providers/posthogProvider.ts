import { PostHog } from 'posthog-node';
import {
  AnalyticsProvider,
  AnalyticsEvent,
  AnalyticsIdentify,
  AnalyticsContext,
  AnalyticsProperties,
  AnalyticsConfig,
} from '../types';
import { logger } from "tttc-common/logger";

/**
 * PostHog analytics provider implementation
 * Provides real analytics tracking using PostHog's Node.js SDK
 */
export class PostHogAnalyticsProvider implements AnalyticsProvider {
  private posthog: PostHog;
  private config: AnalyticsConfig;

  /**
   * Creates a new PostHog analytics provider
   * @param config - PostHog configuration including API key and host
   */
  constructor(config: AnalyticsConfig) {
    this.config = config;
    
    if (!config.apiKey) {
      throw new Error('PostHog API key is required');
    }

    this.posthog = new PostHog(config.apiKey, {
      host: config.host || 'https://app.posthog.com',
      flushAt: config.flushAt || 20,
      flushInterval: config.flushInterval || 10000,
    });

    if (config.debug) {
      logger.debug('POSTHOG ANALYTICS DEBUG: PostHog provider initialized', {
        host: config.host,
        flushAt: config.flushAt,
        flushInterval: config.flushInterval,
      });
    }
  }

  /**
   * Tracks an analytics event via PostHog
   * @param event - The event to track
   */
  async track(event: AnalyticsEvent): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const distinctId = event.context?.user?.userId || 'anonymous';
      const properties = this.buildEventProperties(event.properties, event.context);

      if (this.config.debug) {
        logger.debug('POSTHOG ANALYTICS DEBUG: Tracking event', {
          distinctId,
          event: event.name,
          properties,
        });
      }

      await this.executeWithRetry(
        () => this.posthog.capture({
          distinctId,
          event: event.name,
          properties,
        }),
        'track',
        event.name
      );
    } catch (error) {
      logger.error(
        `POSTHOG ANALYTICS ERROR: Failed to track event ${event.name}:`,
        error
      );
    }
  }

  /**
   * Identifies a user for analytics tracking
   * @param identify - User identification data
   */
  async identify(identify: AnalyticsIdentify): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const properties = this.cleanProperties(identify.traits || {});

      if (this.config.debug) {
        logger.debug('POSTHOG ANALYTICS DEBUG: Identifying user', {
          distinctId: identify.userId,
          properties,
        });
      }

      await this.executeWithRetry(
        () => this.posthog.identify({
          distinctId: identify.userId,
          properties,
        }),
        'identify',
        identify.userId
      );
    } catch (error) {
      logger.error(
        `POSTHOG ANALYTICS ERROR: Failed to identify user ${identify.userId}:`,
        error
      );
    }
  }

  /**
   * Tracks a page view via PostHog
   * @param name - Page or screen name
   * @param properties - Additional properties
   * @param context - Analytics context
   */
  async page(name: string, properties?: AnalyticsProperties, context?: AnalyticsContext): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const distinctId = context?.user?.userId || 'anonymous';
      const eventProperties = this.buildEventProperties(
        {
          $current_url: name,
          ...properties,
        },
        context
      );

      if (this.config.debug) {
        logger.debug('POSTHOG ANALYTICS DEBUG: Tracking page view', {
          distinctId,
          page: name,
          properties: eventProperties,
        });
      }

      await this.executeWithRetry(
        () => this.posthog.capture({
          distinctId,
          event: '$pageview',
          properties: eventProperties,
        }),
        'page',
        name
      );
    } catch (error) {
      logger.error(
        `POSTHOG ANALYTICS ERROR: Failed to track page view ${name}:`,
        error
      );
    }
  }

  /**
   * Flushes any pending analytics data
   */
  async flush(): Promise<void> {
    try {
      await this.posthog.flush();
      
      if (this.config.debug) {
        logger.debug('POSTHOG ANALYTICS DEBUG: Flushed pending data');
      }
    } catch (error) {
      logger.error('POSTHOG ANALYTICS ERROR: Failed to flush data:', error);
    }
  }

  /**
   * Shuts down the PostHog connection and cleans up resources
   */
  async shutdown(): Promise<void> {
    try {
      await this.posthog.shutdown();
      
      if (this.config.debug) {
        logger.debug('POSTHOG ANALYTICS DEBUG: PostHog connection shutdown');
      }
    } catch (error) {
      logger.error('POSTHOG ANALYTICS ERROR: Failed to shutdown PostHog:', error);
    }
  }

  /**
   * Builds event properties by merging event properties with context
   * @param properties - Event properties
   * @param context - Analytics context
   * @returns Merged and cleaned properties
   */
  private buildEventProperties(
    properties?: AnalyticsProperties,
    context?: AnalyticsContext
  ): AnalyticsProperties {
    const eventProperties: AnalyticsProperties = {
      ...this.cleanProperties(properties || {}),
      $timestamp: (context?.timestamp || new Date()).toISOString(),
    };

    // Add user properties
    if (context?.user) {
      if (context.user.email) {
        eventProperties.email = context.user.email;
      }
      
      // Merge user properties
      if (context.user.properties) {
        Object.assign(eventProperties, this.cleanProperties(context.user.properties));
      }
    }

    // Add session context
    if (context?.sessionId) {
      eventProperties.$session_id = context.sessionId;
    }

    // Add request context
    if (context?.requestId) {
      eventProperties.$request_id = context.requestId;
    }

    // Add environment and version
    if (context?.environment) {
      eventProperties.$environment = context.environment;
    }

    if (context?.version) {
      eventProperties.$app_version = context.version;
    }

    return eventProperties;
  }

  /**
   * Cleans properties by removing undefined values and handling circular references
   * @param properties - Properties to clean
   * @returns Cleaned properties
   */
  private cleanProperties(properties: AnalyticsProperties): AnalyticsProperties {
    const cleaned: AnalyticsProperties = {};

    for (const [key, value] of Object.entries(properties)) {
      // Skip undefined values
      if (value === undefined) {
        continue;
      }

      try {
        // Test if value can be serialized (handles circular references)
        JSON.stringify(value);
        cleaned[key] = value;
      } catch (error) {
        // Log circular reference or other serialization errors
        if (this.config.debug) {
          logger.debug(`POSTHOG ANALYTICS DEBUG: Skipping property '${key}' due to serialization error:`, error);
        }
        // Convert to string representation
        cleaned[key] = String(value);
      }
    }

    return cleaned;
  }

  /**
   * Executes a PostHog operation with retry logic
   * @param operation - The operation to execute
   * @param operationType - Type of operation for logging
   * @param identifier - Identifier for the operation (event name, user ID, etc.)
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationType: string,
    identifier: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      // Log the first attempt failure and retry once
      logger.warn(
        `POSTHOG ANALYTICS RETRY: ${operationType} operation failed for ${identifier}, retrying...`,
        error
      );

      try {
        return await operation();
      } catch (retryError) {
        // Log the final failure and re-throw
        logger.error(
          `POSTHOG ANALYTICS ERROR: ${operationType} operation failed after retry for ${identifier}:`,
          retryError
        );
        throw retryError;
      }
    }
  }
}