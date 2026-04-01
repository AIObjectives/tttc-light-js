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
  /**
   * Enable user-selectable AI model support.
   * When disabled, the model field in report creation requests is ignored
   * and the default model is used.
   */
  MODEL_SELECTION_ENABLED: "model_selection_enabled",
} as const;
