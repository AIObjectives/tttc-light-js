/**
 * Centralized query key factory for consistent cache management.
 *
 * Conventions:
 * - Keys are arrays for hierarchical invalidation
 * - Use factory functions for parameterized keys
 * - Group by domain (user, report, etc.)
 *
 * Example invalidation:
 * - queryClient.invalidateQueries({ queryKey: queryKeys.user.all }) - invalidates all user queries
 * - queryClient.invalidateQueries({ queryKey: queryKeys.user.capabilities() }) - invalidates just capabilities
 */
export const queryKeys = {
  user: {
    all: ["user"] as const,
    auth: () => [...queryKeys.user.all, "auth"] as const,
    capabilities: () => [...queryKeys.user.all, "capabilities"] as const,
    // Future: profile, preferences, etc.
    // profile: () => [...queryKeys.user.all, "profile"] as const,
  },
  report: {
    all: ["report"] as const,
    detail: (identifier: string) =>
      [...queryKeys.report.all, "detail", identifier] as const,
  },
  featureFlags: {
    all: ["featureFlags"] as const,
    enabled: (flagName: string, contextKey: string) =>
      [...queryKeys.featureFlags.all, "enabled", flagName, contextKey] as const,
    value: (flagName: string, contextKey: string) =>
      [...queryKeys.featureFlags.all, "value", flagName, contextKey] as const,
  },
} as const;
