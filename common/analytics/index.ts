/**
 * Shared Analytics Module
 *
 * This module provides a unified analytics interface that works across browser and server environments.
 * It supports multiple analytics providers (PostHog, Local) and provides type-safe event tracking,
 * user identification, and page view tracking.
 *
 */

import { AnalyticsConfig, AnalyticsProperties } from "./types";

// Core classes and utilities
export { Analytics } from "./client";

// Convenience functions
export {
  getAnalytics,
  initializeAnalytics,
  trackEvent,
  identifyUser,
  trackPage,
  resetGlobalAnalytics,
} from "./client";

// Types and interfaces
export type {
  AnalyticsClient,
  AnalyticsConfig,
  AnalyticsEvent,
  AnalyticsIdentify,
  AnalyticsContext,
  AnalyticsProperties,
  AnalyticsProvider,
  AnalyticsUser,
  EnvironmentInfo,
} from "./types";

// Common events enum
export { CommonEvents, AnalyticsError } from "./types";

// Environment utilities
export {
  isBrowser,
  isServer,
  isDevelopment,
  getCurrentUrl,
  getUserAgent,
  getEnvironmentInfo,
  generateSessionId,
  generateRequestId,
  getAppVersion,
  getEnvironmentName,
} from "./environment";

// Provider implementations
export { LocalAnalyticsProvider } from "./providers/localProvider";

// Server-only providers (conditionally exported to avoid browser bundle issues)
export type { PostHogAnalyticsProvider } from "./providers/posthogProvider";

/**
 * Helper function to create a basic analytics configuration
 */
export function createAnalyticsConfig(
  provider: "posthog" | "local",
  apiKey?: string,
  options: Partial<Omit<AnalyticsConfig, "provider" | "apiKey">> = {},
): AnalyticsConfig {
  return {
    provider,
    apiKey,
    enabled: true,
    ...options,
  };
}

/**
 * Helper function to create analytics properties for common events
 */
export function createEventProperties(
  eventType: string,
  additionalProperties: Record<string, any> = {},
): AnalyticsProperties {
  return {
    ...additionalProperties,
    event_type: eventType,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper function to safely extract user properties from a user object
 */
export function extractUserProperties(user: any): AnalyticsProperties {
  if (!user) {
    return {};
  }

  const properties: AnalyticsProperties = {};

  // Common user properties to extract
  const fields = ["uid", "email", "displayName", "createdAt", "lastLoginAt"];

  for (const field of fields) {
    if (user[field] !== undefined && user[field] !== null) {
      // Convert dates to ISO strings
      if (user[field] instanceof Date) {
        properties[field] = user[field].toISOString();
      } else {
        properties[field] = user[field];
      }
    }
  }

  return properties;
}
