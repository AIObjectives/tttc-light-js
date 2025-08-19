import { AnalyticsConfig } from './types';
import { Env } from '../types/context';

/**
 * Creates analytics configuration from environment variables
 * @param env - Validated environment variables
 * @returns Analytics configuration object
 * @throws Error if PostHog provider is selected but API key is missing
 */
export function createAnalyticsConfig(env: Env): AnalyticsConfig {
  const config: AnalyticsConfig = {
    provider: env.ANALYTICS_PROVIDER,
    apiKey: env.ANALYTICS_API_KEY,
    host: env.ANALYTICS_HOST,
    flushAt: env.ANALYTICS_FLUSH_AT,
    flushInterval: env.ANALYTICS_FLUSH_INTERVAL,
    debug: env.ANALYTICS_DEBUG,
    enabled: env.ANALYTICS_ENABLED,
  };

  // Validate PostHog configuration
  if (config.provider === 'posthog' && !config.apiKey) {
    throw new Error(
      'ANALYTICS_API_KEY is required when ANALYTICS_PROVIDER is set to "posthog". ' +
      'Please set the ANALYTICS_API_KEY environment variable.'
    );
  }

  return config;
}