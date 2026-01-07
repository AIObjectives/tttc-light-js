"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  getUserCapabilities,
  type UserCapabilities,
} from "@/lib/api/userLimits";
import { useUser } from "@/lib/hooks/getUser";
import { queryKeys } from "@/lib/query/queryKeys";

const DEFAULT_SIZE_LIMIT = 150 * 1024; // 150KB

/**
 * Fetches user capabilities using React Query.
 *
 * Features:
 * - Automatic retries with exponential backoff (configured in QueryProvider)
 * - Caching and deduplication of requests
 * - Dependent on auth state - only fetches when user is logged in
 * - Shows toast on persistent failure
 * - Returns default values when not authenticated or on error
 *
 * Migration note: This replaces the p-retry based useUserCapabilities hook.
 * The interface is intentionally backward-compatible.
 */
export function useUserCapabilitiesQuery() {
  const { user, loading: authLoading } = useUser();
  const queryClient = useQueryClient();

  // Track if we've shown the error toast to avoid repeated toasts
  const hasShownErrorToast = useRef(false);

  const {
    data,
    isLoading: queryLoading,
    isError,
    error,
    refetch,
    isSuccess,
    isFetched,
  } = useQuery<UserCapabilities | null>({
    queryKey: queryKeys.user.capabilities(),
    queryFn: getUserCapabilities,
    // Only run query when auth is settled AND user is logged in
    enabled: !authLoading && !!user,
    // Capabilities rarely change - keep fresh for 10 minutes
    staleTime: 10 * 60 * 1000,
    // Keep in cache for 30 minutes
    gcTime: 30 * 60 * 1000,
    // Use defaults configured in QueryProvider for retry
  });

  // Show toast on persistent failure (after all retries exhausted)
  useEffect(() => {
    if (isError && !hasShownErrorToast.current) {
      hasShownErrorToast.current = true;
      toast.error("Unable to load enhanced upload limits", {
        description: `Using default ${(DEFAULT_SIZE_LIMIT / 1024).toFixed(0)}KB limit. You can still upload files.`,
        position: "top-center",
      });
    }
    // Reset toast flag on successful fetch
    if (isSuccess) {
      hasShownErrorToast.current = false;
    }
  }, [isError, isSuccess]);

  // Invalidate capabilities cache when user changes (login/logout)
  const prevUserId = useRef<string | null>(null);
  useEffect(() => {
    const currentUserId = user?.uid ?? null;
    if (prevUserId.current !== null && prevUserId.current !== currentUserId) {
      // User changed - invalidate capabilities cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.capabilities(),
      });
      hasShownErrorToast.current = false;
    }
    prevUserId.current = currentUserId;
  }, [user?.uid, queryClient]);

  // Compute loading state - loading if auth is loading OR query is loading
  const isLoading = authLoading || (!!user && queryLoading);

  // Compute "capabilities loaded" - backwards compatible with old hook
  // True when: auth is settled AND (not logged in OR query has completed)
  const capabilitiesLoaded = !authLoading && (!user || isFetched);

  // Extract size limit from data, fallback to default
  const userSizeLimit = data?.csvSizeLimit ?? DEFAULT_SIZE_LIMIT;

  return {
    // Primary data
    userSizeLimit,

    // Loading states - backward compatible naming
    capabilitiesLoaded,
    isLoading,

    // Error state
    error: isError
      ? error instanceof Error
        ? error
        : new Error("Unknown error")
      : null,

    // Manual retry function - backward compatible
    retry: refetch,

    // Additional React Query states for advanced use cases
    isSuccess,
    isFetched,
  };
}
