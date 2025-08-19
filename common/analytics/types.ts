/**
 * Analytics event properties that can be attached to any event
 */
export interface AnalyticsProperties {
  [key: string]: string | number | boolean | null | undefined | object;
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
  platform?: "browser" | "server";
  url?: string;
  userAgent?: string;
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
 * Configuration for analytics providers
 */
export interface AnalyticsConfig {
  provider?: "posthog" | "local";
  apiKey?: string;
  host?: string;
  flushAt?: number;
  flushInterval?: number;
  environment?: string;
  version?: string;
  enabled?: boolean;
}

/**
 * Interface for analytics providers
 * All analytics providers must implement these methods
 */
export interface AnalyticsProvider {
  /**
   * Tracks an analytics event
   */
  track(event: AnalyticsEvent): Promise<void>;

  /**
   * Identifies a user for analytics
   */
  identify(identify: AnalyticsIdentify): Promise<void>;

  /**
   * Sets up page/screen view tracking
   */
  page(
    name: string,
    properties?: AnalyticsProperties,
    context?: AnalyticsContext,
  ): Promise<void>;

  /**
   * Flushes any pending analytics data
   */
  flush(): Promise<void>;

  /**
   * Shuts down the analytics provider and cleans up resources
   */
  shutdown(): Promise<void>;

  /**
   * Checks if the provider is initialized and ready to use
   */
  isReady(): boolean;
}

/**
 * Common analytics events used throughout the application
 */
export enum CommonEvents {
  // User authentication events
  USER_SIGNIN = "user_signin",
  USER_SIGNOUT = "user_signout",
  USER_REGISTRATION = "user_registration",

  // Report-related events
  REPORT_CREATED = "report_created",
  REPORT_VIEWED = "report_viewed",
  REPORT_DOWNLOADED = "report_downloaded",
  REPORT_SHARED = "report_shared",

  // Pipeline events
  PIPELINE_STARTED = "pipeline_started",
  PIPELINE_COMPLETED = "pipeline_completed",
  PIPELINE_FAILED = "pipeline_failed",

  // Navigation and interaction events
  PAGE_VIEW = "page_view",
  BUTTON_CLICKED = "button_clicked",
  LINK_CLICKED = "link_clicked",
  FORM_SUBMITTED = "form_submitted",

  // API and system events
  API_REQUEST = "api_request",
  ERROR_OCCURRED = "error_occurred",
  FEATURE_USED = "feature_used",

  // Engagement events
  SESSION_STARTED = "session_started",
  SESSION_ENDED = "session_ended",
  CONTENT_ENGAGEMENT = "content_engagement",

  // Performance events
  PERFORMANCE_METRIC = "performance_metric",
  LOAD_TIME = "load_time",
}

/**
 * Error types for analytics operations
 */
export class AnalyticsError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly operation: string,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = "AnalyticsError";
  }
}

/**
 * Environment detection utility
 */
export interface EnvironmentInfo {
  platform: "browser" | "server";
  isDevelopment: boolean;
  userAgent?: string;
  url?: string;
}

/**
 * Analytics client interface for browser and server implementations
 */
export interface AnalyticsClient {
  initialize(config: AnalyticsConfig): Promise<void>;
  track(event: AnalyticsEvent): Promise<void>;
  identify(identify: AnalyticsIdentify): Promise<void>;
  page(
    name: string,
    properties?: AnalyticsProperties,
    context?: AnalyticsContext,
  ): Promise<void>;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
  isInitialized(): boolean;
  getEnvironmentInfo(): EnvironmentInfo;
}
