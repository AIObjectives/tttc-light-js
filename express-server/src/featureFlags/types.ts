export interface FeatureFlagContext {
  userId?: string;
  email?: string;
  groups?: Record<string, string>;
  properties?: Record<string, any>;
}

export interface FeatureFlagProvider {
  isEnabled(flagName: string, context: FeatureFlagContext): Promise<boolean>;
  getFeatureFlag(
    flagName: string,
    context: FeatureFlagContext,
  ): Promise<string | boolean | number | null>;
  getAllFlags(
    context: FeatureFlagContext,
  ): Promise<Record<string, string | boolean | number>>;
  shutdown(): Promise<void>;
}
