"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  type FeatureFlagContext,
  getFeatureFlag,
  isFeatureEnabled,
} from "@/lib/feature-flags/featureFlags";
import { queryKeys } from "./queryKeys";

// Feature flags change infrequently - cache for 5 minutes
const FEATURE_FLAG_STALE_TIME = 5 * 60 * 1000;

/**
 * Serialize context to a stable string key for query caching.
 */
function serializeContext(context?: FeatureFlagContext): string {
  return context ? JSON.stringify(context) : "";
}

/**
 * TanStack Query hook to check if a feature flag is enabled.
 * Returns the current enabled state and a loading indicator.
 *
 * @param flagName - The name of the feature flag to check
 * @param context - Optional context information for evaluating the flag
 * @returns An object containing the enabled state and loading indicator
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const context = useMemo(() => ({ userId: "user123" }), []);
 *   const { enabled, loading } = useFeatureFlagQuery("new-ui", context);
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (!enabled) return <div>Feature not available</div>;
 *   return <div>New UI enabled!</div>;
 * }
 * ```
 */
export function useFeatureFlagQuery(
  flagName: string,
  context?: FeatureFlagContext,
): { enabled: boolean; loading: boolean } {
  const contextKey = useMemo(() => serializeContext(context), [context]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.featureFlags.enabled(flagName, contextKey),
    queryFn: () => isFeatureEnabled(flagName, context),
    staleTime: FEATURE_FLAG_STALE_TIME,
    // Return false on error (safe fallback)
    retry: 1,
  });

  return {
    enabled: data ?? false,
    loading: isLoading,
  };
}

/**
 * TanStack Query hook to get a feature flag value.
 * Returns the current flag value and a loading indicator.
 *
 * @param flagName - The name of the feature flag to retrieve
 * @param context - Optional context information for evaluating the flag
 * @returns An object containing the flag value and loading indicator
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { value, loading } = useFeatureFlagValueQuery<string>("theme-variant");
 *
 *   if (loading) return <div>Loading...</div>;
 *   return <div>Theme: {value || "default"}</div>;
 * }
 * ```
 */
export function useFeatureFlagValueQuery<
  T extends string | boolean | number | null = string | boolean | number | null,
>(
  flagName: string,
  context?: FeatureFlagContext,
): { value: T | null; loading: boolean } {
  const contextKey = useMemo(() => serializeContext(context), [context]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.featureFlags.value(flagName, contextKey),
    queryFn: () => getFeatureFlag(flagName, context),
    staleTime: FEATURE_FLAG_STALE_TIME,
    // Return null on error (safe fallback)
    retry: 1,
  });

  return {
    value: (data as T) ?? null,
    loading: isLoading,
  };
}
