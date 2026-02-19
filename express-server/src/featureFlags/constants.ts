/**
 * Feature flag constants for the express server.
 * Centralized location for all feature flag names.
 */
export const FEATURE_FLAGS = {
  /**
   * Use Node worker queue instead of PubSub queue for pipeline jobs.
   * When enabled, jobs are sent to NODE_WORKER_QUEUE instead of PUBSUB_QUEUE.
   */
  USE_NODE_WORKER_QUEUE: "use_node_worker_queue",

  /**
   * Enable the elicitation/studies feature.
   * When disabled, all /api/elicitation/* endpoints return 403.
   */
  ELICITATION_ENABLED: "elicitation_enabled",
} as const;
