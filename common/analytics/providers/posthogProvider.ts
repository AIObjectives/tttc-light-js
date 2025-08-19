import type {
  AnalyticsProvider,
  AnalyticsEvent,
  AnalyticsIdentify,
  AnalyticsContext,
  AnalyticsProperties,
  AnalyticsConfig,
} from '../types';
import { logger } from '../../logger';
import { PostHog } from 'posthog-node'

/**
 * PostHog analytics provider implementation for server environments
 * Provides real analytics tracking using PostHog's Node.js SDK
 */
export class PostHogAnalyticsProvider implements AnalyticsProvider {
  private posthog: any = null;
  private config: AnalyticsConfig;
  private ready: boolean = false;

  /**
   * Creates a new PostHog analytics provider
   */
  constructor(config: AnalyticsConfig) {
    this.config = config;
    
    if (!config.apiKey) {
      throw new Error('PostHog API key is required');
    }
  }

  /**
   * Initializes the PostHog provider
   */
  private async initialize(): Promise<void> {
    if (this.ready) {
      return;
    }

    try {
      this.posthog = new PostHog(this.config.apiKey!, {
        host: this.config.host || 'https://us.i.posthog.com',
        flushAt: this.config.flushAt || 20,
        flushInterval: this.config.flushInterval || 10000,
      });

      this.ready = true;
      logger.info('POSTHOG ANALYTICS: Provider initialized successfully');
    } catch (error) {
      logger.error('POSTHOG ANALYTICS ERROR: Failed to initialize provider:', error);
      throw error;
    }
  }

  /**
   * Tracks an analytics event via PostHog
   */
  async track(event: AnalyticsEvent): Promise<void> {
    await this.ensureInitialized();

    try {
      const distinctId = event.context?.user?.userId || 'anonymous';
      const properties = this.buildEventProperties(event.properties, event.context);

      await this.executeWithRetry(
        async () => this.posthog.capture({
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
   */
  async identify(identify: AnalyticsIdentify): Promise<void> {
    await this.ensureInitialized();

    try {
      const properties = this.cleanProperties(identify.traits || {});

      await this.executeWithRetry(
        async () => this.posthog.identify({
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
   */
  async page(name: string, properties?: AnalyticsProperties, context?: AnalyticsContext): Promise<void> {
    await this.ensureInitialized();

    try {
      const distinctId = context?.user?.userId || 'anonymous';
      const eventProperties = this.buildEventProperties(
        {
          $current_url: context?.url || name,
          page_name: name,
          ...properties,
        },
        context
      );

      await this.executeWithRetry(
        async () => this.posthog.capture({
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
    if (!this.posthog) {
      return;
    }

    try {
      await this.posthog.flush();
    } catch (error) {
      logger.error('POSTHOG ANALYTICS ERROR: Failed to flush data:', error);
    }
  }

  /**
   * Shuts down the PostHog connection and cleans up resources
   */
  async shutdown(): Promise<void> {
    if (!this.posthog) {
      return;
    }

    try {
      await this.posthog.shutdown();
      this.posthog = null;
      this.ready = false;
    } catch (error) {
      logger.error('POSTHOG ANALYTICS ERROR: Failed to shutdown PostHog:', error);
    }
  }

  /**
   * Checks if the provider is ready
   */
  isReady(): boolean {
    return this.ready && this.posthog !== null;
  }

  /**
   * Ensures the provider is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.ready) {
      await this.initialize();
    }
  }

  /**
   * Builds event properties by merging event properties with context
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

    // Add platform information
    if (context?.platform) {
      eventProperties.$platform = context.platform;
    }

    if (context?.userAgent) {
      eventProperties.$user_agent = context.userAgent;
    }

    if (context?.url) {
      eventProperties.$current_url = context.url;
    }

    return eventProperties;
  }

  /**
   * Cleans properties by removing undefined values and handling circular references
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
        // Convert to string representation
        cleaned[key] = String(value);
      }
    }

    return cleaned;
  }

  /**
   * Executes a PostHog operation with retry logic
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
