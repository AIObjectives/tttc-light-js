import {
  AnalyticsProvider,
  AnalyticsEvent,
  AnalyticsIdentify,
  AnalyticsContext,
  AnalyticsProperties,
  AnalyticsConfig,
} from './types';
import { LocalAnalyticsProvider } from './providers/localProvider';
import { PostHogAnalyticsProvider } from './providers/posthogProvider';
import { logger } from "tttc-common/logger";

/**
 * Global analytics provider instance
 */
let analyticsProvider: AnalyticsProvider | null = null;

/**
 * Initializes the analytics system with the specified provider
 * @param config - Analytics configuration
 * @returns The initialized analytics provider
 * @throws Error if the provider is unknown or configuration is invalid
 */
export function initializeAnalytics(config: AnalyticsConfig): AnalyticsProvider {
  try {
    // Shutdown existing provider if one exists
    if (analyticsProvider) {
      analyticsProvider.shutdown().catch(error => {
        logger.error('ANALYTICS: Error shutting down previous provider:', error);
      });
    }

    // Create new provider based on configuration
    switch (config.provider) {
      case 'local':
        analyticsProvider = new LocalAnalyticsProvider({
          debug: config.debug,
          enabled: config.enabled,
        });
        break;

      case 'posthog':
        if (!config.apiKey) {
          throw new Error('PostHog API key is required for PostHog provider');
        }
        analyticsProvider = new PostHogAnalyticsProvider(config);
        break;

      default:
        throw new Error(`Unknown analytics provider: ${(config as any).provider}`);
    }

    logger.info(`ANALYTICS: Initialized ${config.provider} analytics provider`, {
      enabled: config.enabled,
      debug: config.debug,
    });

    return analyticsProvider;
  } catch (error) {
    logger.error('ANALYTICS: Failed to initialize analytics provider:', error);
    throw error;
  }
}

/**
 * Tracks an analytics event using the configured provider
 * @param event - The event to track
 * @returns Promise that resolves when the event is tracked
 * 
 * Usage example:
 * ```typescript
 * await trackEvent({
 *   name: CommonEvents.USER_SIGNIN,
 *   properties: {
 *     method: 'firebase',
 *     provider: 'google',
 *   },
 *   context: {
 *     user: { userId: 'user123', email: 'user@example.com' },
 *     sessionId: 'session456',
 *   },
 * });
 * ```
 */
export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  if (!analyticsProvider) {
    logger.warn('ANALYTICS: No analytics provider initialized, skipping event tracking');
    return;
  }

  try {
    await analyticsProvider.track(event);
  } catch (error) {
    logger.error(`ANALYTICS: Failed to track event ${event.name}:`, error);
  }
}

/**
 * Identifies a user for analytics tracking
 * @param identify - User identification data
 * @returns Promise that resolves when the user is identified
 * 
 * Usage example:
 * ```typescript
 * await identifyUser({
 *   userId: 'user123',
 *   traits: {
 *     name: 'John Doe',
 *     email: 'john@example.com',
 *     plan: 'premium',
 *     createdAt: '2023-01-01',
 *   },
 * });
 * ```
 */
export async function identifyUser(identify: AnalyticsIdentify): Promise<void> {
  if (!analyticsProvider) {
    logger.warn('ANALYTICS: No analytics provider initialized, skipping user identification');
    return;
  }

  try {
    await analyticsProvider.identify(identify);
  } catch (error) {
    logger.error(`ANALYTICS: Failed to identify user ${identify.userId}:`, error);
  }
}

/**
 * Tracks a page view or screen view
 * @param name - Page or screen name
 * @param properties - Additional properties
 * @param context - Analytics context
 * @returns Promise that resolves when the page view is tracked
 * 
 * Usage example:
 * ```typescript
 * await trackPage('Dashboard', {
 *   section: 'reports',
 *   reportId: 'report123',
 * }, {
 *   user: { userId: 'user123' },
 *   sessionId: 'session456',
 * });
 * ```
 */
export async function trackPage(
  name: string, 
  properties?: AnalyticsProperties, 
  context?: AnalyticsContext
): Promise<void> {
  if (!analyticsProvider) {
    logger.warn('ANALYTICS: No analytics provider initialized, skipping page tracking');
    return;
  }

  try {
    await analyticsProvider.page(name, properties, context);
  } catch (error) {
    logger.error(`ANALYTICS: Failed to track page ${name}:`, error);
  }
}

/**
 * Flushes any pending analytics data
 * @returns Promise that resolves when all data is flushed
 * 
 * Usage example:
 * ```typescript
 * // Before server shutdown
 * await flushAnalytics();
 * ```
 */
export async function flushAnalytics(): Promise<void> {
  if (!analyticsProvider) {
    logger.warn('ANALYTICS: No analytics provider initialized, skipping flush');
    return;
  }

  try {
    await analyticsProvider.flush();
    logger.info('ANALYTICS: Successfully flushed analytics data');
  } catch (error) {
    logger.error('ANALYTICS: Failed to flush analytics data:', error);
  }
}

/**
 * Shuts down the analytics system and cleans up resources
 * @returns Promise that resolves when shutdown is complete
 * 
 * Usage example:
 * ```typescript
 * // During server shutdown
 * await shutdownAnalytics();
 * ```
 */
export async function shutdownAnalytics(): Promise<void> {
  if (!analyticsProvider) {
    return;
  }

  try {
    await analyticsProvider.shutdown();
    logger.info('ANALYTICS: Successfully shut down analytics provider');
    analyticsProvider = null;
  } catch (error) {
    logger.error('ANALYTICS: Failed to shutdown analytics provider:', error);
  }
}

/**
 * Gets the current analytics provider instance
 * @returns The current provider or null if not initialized
 */
export function getAnalyticsProvider(): AnalyticsProvider | null {
  return analyticsProvider;
}

/**
 * Checks if analytics is initialized
 * @returns True if analytics is initialized
 */
export function isAnalyticsInitialized(): boolean {
  return analyticsProvider !== null;
}

/**
 * Helper function to create analytics context from request data
 * @param userId - User ID
 * @param sessionId - Session ID
 * @param requestId - Request ID
 * @param email - User email
 * @param additionalProperties - Additional user properties
 * @returns Analytics context object
 * 
 * Usage example:
 * ```typescript
 * const context = createAnalyticsContext(
 *   user.uid,
 *   req.session?.id,
 *   req.id,
 *   user.email,
 *   { plan: user.plan }
 * );
 * 
 * await trackEvent({
 *   name: CommonEvents.API_REQUEST,
 *   properties: { endpoint: '/api/reports' },
 *   context,
 * });
 * ```
 */
export function createAnalyticsContext(
  userId?: string,
  sessionId?: string,
  requestId?: string,
  email?: string,
  additionalProperties?: AnalyticsProperties,
  environment?: string,
  version?: string
): AnalyticsContext {
  return {
    user: userId || email ? {
      userId,
      email,
      properties: additionalProperties,
    } : undefined,
    sessionId,
    requestId,
    timestamp: new Date(),
    environment: environment || process.env.NODE_ENV,
    version: version || process.env.APP_VERSION,
  };
}

// Re-export types for convenience
export * from './types';