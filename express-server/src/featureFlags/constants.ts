/**
 * Feature flag constants for the express server.
 * Centralized location for all feature flag names.
 */
export const FEATURE_FLAGS = {
  /**
   * Enable the elicitation/studies feature.
   * When disabled, all /api/elicitation/* endpoints return 403.
   */
  ELICITATION_ENABLED: "elicitation_enabled",
} as const;
