"use client";

import { useQuery } from "@tanstack/react-query";
import { type AuthState, getInitialAuthState } from "./authSubscription";
import { queryKeys } from "./queryKeys";

/**
 * TanStack Query hook for accessing auth state.
 *
 * The auth subscription is managed by authSubscription.ts and pushes
 * updates to the query cache via setQueryData. This hook simply reads
 * from the cache.
 *
 * @returns AuthState - same interface as the legacy useUser hook
 *
 * @example
 * ```tsx
 * const { user, loading, error, emailVerified } = useUserQuery();
 *
 * if (loading) return <Spinner />;
 * if (!user) return <SignInPrompt />;
 *
 * return <UserProfile user={user} />;
 * ```
 */
export function useUserQuery(): AuthState {
  const { data } = useQuery<AuthState>({
    queryKey: queryKeys.user.auth(),
    // No real queryFn needed - data is populated by the auth subscription.
    // This fallback only runs if the subscription hasn't initialized yet.
    queryFn: getInitialAuthState,
    // Data is always fresh via subscription - never stale
    staleTime: Number.POSITIVE_INFINITY,
    // Keep in cache indefinitely - auth state should persist
    gcTime: Number.POSITIVE_INFINITY,
    // Never refetch - subscription handles all updates
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return data ?? getInitialAuthState();
}
