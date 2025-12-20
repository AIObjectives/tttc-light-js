/**
 * Shared Analytics Module
 *
 * This module provides a unified analytics interface that works across browser and server environments.
 * It supports multiple analytics providers (PostHog, Local) and provides type-safe event tracking,
 * user identification, and page view tracking.
 *
 */

import type { AnalyticsConfig, AnalyticsProperties } from "./types";

// Core classes and utilities
// Convenience functions
export {
  Analytics,
  getAnalytics,
  identifyUser,
  initializeAnalytics,
  resetGlobalAnalytics,
  trackEvent,
  trackPage,
} from "./client";
// Environment utilities
export {
  generateRequestId,
  generateSessionId,
  getAppVersion,
  getCurrentUrl,
  getEnvironmentInfo,
  getEnvironmentName,
  getUserAgent,
  isBrowser,
  isDevelopment,
  isServer,
} from "./environment";
// Provider implementations
export { LocalAnalyticsProvider } from "./providers/localProvider";
// Server-only providers (conditionally exported to avoid browser bundle issues)
export type { PostHogAnalyticsProvider } from "./providers/posthogProvider";
// Types and interfaces
export type {
  AnalyticsClient,
  AnalyticsConfig,
  AnalyticsContext,
  AnalyticsEvent,
  AnalyticsIdentify,
  AnalyticsProperties,
  AnalyticsProvider,
  AnalyticsUser,
  EnvironmentInfo,
} from "./types";
// Common events enum
export { AnalyticsError, CommonEvents } from "./types";

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
