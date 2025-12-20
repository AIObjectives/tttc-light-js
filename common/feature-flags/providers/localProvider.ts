import type { FeatureFlagContext, FeatureFlagProvider } from "../types";

/**
 * Local implementation of feature flag provider.
 * Stores feature flags in memory and does not depend on external services.
 * Useful for development and testing environments.
 */
export class LocalFeatureFlagProvider implements FeatureFlagProvider {
  private flags: Record<string, boolean | string | number>;

  /**
   * Creates a new LocalFeatureFlagProvider instance.
   *
   * @param flags - Initial feature flags to store (defaults to empty object)
   */
  constructor(flags: Record<string, boolean | string | number> = {}) {
    this.flags = flags;
  }

  /**
   * Checks if a feature flag is enabled.
   * For local provider, returns true if the flag exists and is truthy.
   *
   * @param flagName - The name of the feature flag to check
   * @param _context - Context information (not used by local provider)
   * @returns Promise resolving to true if the flag is truthy, false otherwise
   */
  async isEnabled(
    flagName: string,
    _context: FeatureFlagContext,
  ): Promise<boolean> {
    const flag = this.flags[flagName];
    return Boolean(flag);
  }

  /**
   * Gets the value of a feature flag.
   *
   * @param flagName - The name of the feature flag to retrieve
   * @param _context - Context information (not used by local provider)
   * @returns Promise resolving to the flag value, or null if not found
   */
  async getFeatureFlag(
    flagName: string,
    _context: FeatureFlagContext,
  ): Promise<string | boolean | number | null> {
    return this.flags[flagName] ?? null;
  }

  /**
   * Shuts down the provider.
   * No cleanup needed for local provider.
   *
   * @returns Promise that resolves immediately
   */
  async shutdown(): Promise<void> {
    // No cleanup needed for local provider
  }
}
