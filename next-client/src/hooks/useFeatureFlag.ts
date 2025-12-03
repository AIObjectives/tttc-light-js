"use client";

import { useState, useEffect, useMemo } from "react";
import {
  isFeatureEnabled,
  getFeatureFlag,
  FeatureFlagContext,
} from "../lib/feature-flags/featureFlags";

/**
 * React hook to check if a feature flag is enabled.
 * Returns the current enabled state and a loading indicator.
 *
 * @param flagName - The name of the feature flag to check
 * @param context - Optional context information for evaluating the flag.
 *                  Note: To avoid unnecessary re-fetches, memoize the context object
 *                  if passing inline: `useMemo(() => ({ userId }), [userId])`
 * @returns An object containing the enabled state and loading indicator
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   // Memoize context to prevent re-fetching on every render
 *   const context = useMemo(() => ({ userId: "user123" }), []);
 *   const { enabled, loading } = useFeatureFlag("new-ui", context);
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (!enabled) return <div>Feature not available</div>;
 *   return <div>New UI enabled!</div>;
 * }
 * ```
 */
export function useFeatureFlag(
  flagName: string,
  context?: FeatureFlagContext,
): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Stringify context for stable comparison
  const contextKey = useMemo(
    () => (context ? JSON.stringify(context) : ""),
    [context],
  );

  useEffect(() => {
    let isMounted = true;

    async function checkFlag() {
      try {
        const result = await isFeatureEnabled(flagName, context);
        if (isMounted) {
          setEnabled(result);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error checking feature flag:", error);
        if (isMounted) {
          setEnabled(false);
          setLoading(false);
        }
      }
    }

    checkFlag();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagName, contextKey]);

  return { enabled, loading };
}

/**
 * React hook to get a feature flag value.
 * Returns the current flag value and a loading indicator.
 *
 * @param flagName - The name of the feature flag to retrieve
 * @param context - Optional context information for evaluating the flag.
 *                  Note: To avoid unnecessary re-fetches, memoize the context object
 *                  if passing inline: `useMemo(() => ({ userId }), [userId])`
 * @returns An object containing the flag value and loading indicator
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { value, loading } = useFeatureFlagValue<string>("theme-variant");
 *
 *   if (loading) return <div>Loading...</div>;
 *   return <div>Theme: {value || "default"}</div>;
 * }
 * ```
 */
export function useFeatureFlagValue<
  T extends string | boolean | number | null = string | boolean | number | null,
>(
  flagName: string,
  context?: FeatureFlagContext,
): { value: T | null; loading: boolean } {
  const [value, setValue] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  // Stringify context for stable comparison
  const contextKey = useMemo(
    () => (context ? JSON.stringify(context) : ""),
    [context],
  );

  useEffect(() => {
    let isMounted = true;

    async function fetchFlag() {
      try {
        const result = await getFeatureFlag(flagName, context);
        if (isMounted) {
          setValue(result as T);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error getting feature flag:", error);
        if (isMounted) {
          setValue(null);
          setLoading(false);
        }
      }
    }

    fetchFlag();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagName, contextKey]);

  return { value, loading };
}
