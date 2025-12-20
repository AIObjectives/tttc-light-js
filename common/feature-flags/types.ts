/**
 * Context information for evaluating feature flags.
 * Used to determine if a feature should be enabled for a specific user or group.
 */
export interface FeatureFlagContext {
  /**
   * Unique identifier for the user.
   */
  userId?: string;

  /**
   * Email address of the user.
   */
  email?: string;

  /**
   * Group memberships for the user (e.g., company, team).
   */
  groups?: Record<string, string>;

  /**
   * Additional properties for feature flag evaluation (e.g., plan, region).
   */
  // biome-ignore lint/suspicious/noExplicitAny: PostHog SDK requires Record<string, any> for properties
  properties?: Record<string, any>;
}

/**
 * Interface for feature flag providers.
 * Implementations provide different backends for feature flag evaluation (e.g., local, PostHog).
 */
export interface FeatureFlagProvider {
  /**
   * Checks if a feature flag is enabled for the given context.
   *
   * @param flagName - The name of the feature flag to check
   * @param context - Context information for evaluating the flag
   * @returns Promise resolving to true if the flag is enabled, false otherwise
   */
  isEnabled(flagName: string, context: FeatureFlagContext): Promise<boolean>;

  /**
   * Gets the value of a feature flag for the given context.
   * Supports boolean, string, and number flag values.
   *
   * @param flagName - The name of the feature flag to retrieve
   * @param context - Context information for evaluating the flag
   * @returns Promise resolving to the flag value, or null if not found
   */
  getFeatureFlag(
    flagName: string,
    context: FeatureFlagContext,
  ): Promise<string | boolean | number | null>;

  /**
   * Shuts down the feature flag provider and performs any necessary cleanup.
   * Should be called when the application is shutting down.
   *
   * @returns Promise that resolves when shutdown is complete
   */
  shutdown(): Promise<void>;
}
