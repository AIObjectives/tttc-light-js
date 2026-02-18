"use client";

import { useQuery } from "@tanstack/react-query";
import { elicitationEventsResponse } from "tttc-common/api";
import type { ElicitationEventSummary } from "tttc-common/firebase";
import { logger } from "tttc-common/logger/browser";
import { fetchWithRequestId } from "@/lib/api/fetchWithRequestId";
import { queryKeys } from "@/lib/query/queryKeys";
import { useUserQuery } from "@/lib/query/useUserQuery";

const elicitationEventsLogger = logger.child({
  module: "elicitation-events",
});

/**
 * Fetch elicitation events from the API.
 *
 * @param authToken - Optional Firebase auth token for authenticated requests
 * @internal Exported for testing
 */
export async function fetchElicitationEvents(
  authToken?: string,
): Promise<ElicitationEventSummary[]> {
  const headers: Record<string, string> = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetchWithRequestId("/api/elicitation/events", {
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data = elicitationEventsResponse.parse(await response.json());
  return data.events;
}

/**
 * Hook to fetch elicitation events using TanStack Query.
 *
 * Features:
 * - Automatic caching with 5-minute stale time
 * - Authenticated requests when user is logged in
 * - Automatic retries with exponential backoff
 *
 * @returns Object with events, loading state, error state, and refresh function
 */
export function useElicitationEvents() {
  const { user } = useUserQuery();

  const { data, isLoading, isError, error, refetch } = useQuery<
    ElicitationEventSummary[],
    Error
  >({
    queryKey: queryKeys.elicitationEvents.list(),
    queryFn: async () => {
      elicitationEventsLogger.debug("Fetching elicitation events");
      // Get fresh auth token if user is logged in
      const authToken = user ? await user.getIdToken() : undefined;
      return fetchElicitationEvents(authToken);
    },

    // Cache for 5 minutes
    staleTime: 5 * 60 * 1000,

    // Retry up to 3 times on errors
    retry: 3,
  });

  return {
    events: data ?? [],
    isLoading,
    isError,
    error: error ?? undefined,
    refresh: refetch,
  };
}
