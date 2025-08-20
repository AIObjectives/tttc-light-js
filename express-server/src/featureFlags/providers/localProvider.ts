import { FeatureFlagProvider, FeatureFlagContext } from "../types";

export class LocalFeatureFlagProvider implements FeatureFlagProvider {
  private flags: Record<string, boolean | string>;

  constructor(flags: Record<string, boolean | string> = {}) {
    this.flags = flags;
  }

  async isEnabled(
    flagName: string,
    _context: FeatureFlagContext,
  ): Promise<boolean> {
    const flag = this.flags[flagName];
    return Boolean(flag);
  }

  async getFeatureFlag(
    flagName: string,
    _context: FeatureFlagContext,
  ): Promise<string | boolean | null> {
    return this.flags[flagName] ?? null;
  }

  async getAllFlags(
    _context: FeatureFlagContext,
  ): Promise<Record<string, string | boolean>> {
    return { ...this.flags };
  }

  async shutdown(): Promise<void> {
    // No cleanup needed for local provider
  }
}
