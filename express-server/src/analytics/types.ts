/**
 * Analytics event properties that can be attached to any event
 */
export interface AnalyticsProperties {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * User context for analytics events
 */
export interface AnalyticsUser {
  userId?: string;
  email?: string;
  properties?: AnalyticsProperties;
}

/**
 * Context information for analytics events including user and session data
 */
export interface AnalyticsContext {
  user?: AnalyticsUser;
  sessionId?: string;
  requestId?: string;
  timestamp?: Date;
  environment?: string;
  version?: string;
}

/**
 * Analytics event definition
 */
export interface AnalyticsEvent {
  name: string;
  properties?: AnalyticsProperties;
  context?: AnalyticsContext;
}

/**
 * User identification for analytics providers
 */
export interface AnalyticsIdentify {
  userId: string;
  traits?: AnalyticsProperties;
  context?: AnalyticsContext;
}

/**
 * Interface for analytics providers
 * All analytics providers must implement these methods
 */
export interface AnalyticsProvider {
  /**
   * Tracks an analytics event
   * @param event - The event to track
   * @returns Promise that resolves when event is tracked
   */
  track(event: AnalyticsEvent): Promise<void>;

  /**
   * Identifies a user for analytics
   * @param identify - User identification data
   * @returns Promise that resolves when user is identified
   */
  identify(identify: AnalyticsIdentify): Promise<void>;

  /**
   * Sets up page/screen view tracking
   * @param name - Page or screen name
   * @param properties - Additional properties
   * @param context - Analytics context
   * @returns Promise that resolves when page view is tracked
   */
  page(name: string, properties?: AnalyticsProperties, context?: AnalyticsContext): Promise<void>;

  /**
   * Flushes any pending analytics data
   * @returns Promise that resolves when data is flushed
   */
  flush(): Promise<void>;

  /**
   * Shuts down the analytics provider and cleans up resources
   * @returns Promise that resolves when shutdown is complete
   */
  shutdown(): Promise<void>;
}

/**
 * Configuration for analytics providers
 */
export interface AnalyticsConfig {
  provider: 'posthog' | 'local';
  apiKey?: string;
  host?: string;
  flushAt?: number;
  flushInterval?: number;
  debug?: boolean;
  enabled?: boolean;
}

/**
 * Common analytics events used throughout the application
 */
export enum CommonEvents {
  USER_SIGNIN = 'user_signin',
  USER_SIGNOUT = 'user_signout',
  USER_REGISTRATION = 'user_registration',
  REPORT_CREATED = 'report_created',
  REPORT_VIEWED = 'report_viewed',
  REPORT_DOWNLOADED = 'report_downloaded',
  PIPELINE_STARTED = 'pipeline_started',
  PIPELINE_COMPLETED = 'pipeline_completed',
  PIPELINE_FAILED = 'pipeline_failed',
  API_REQUEST = 'api_request',
  ERROR_OCCURRED = 'error_occurred',
  FEATURE_USED = 'feature_used',
}

/**
 * Error types for analytics operations
 */
export class AnalyticsError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly operation: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'AnalyticsError';
  }
}