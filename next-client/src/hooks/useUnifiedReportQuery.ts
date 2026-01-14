"use client";

import type { Query } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type * as api from "tttc-common/api";
import type { ReportRef } from "tttc-common/firebase";
import { logger } from "tttc-common/logger/browser";
import { fetchWithRequestId } from "@/lib/api/fetchWithRequestId";
import { queryKeys } from "@/lib/query/queryKeys";

const unifiedReportLogger = logger.child({ module: "unified-report-query" });

/**
 * Response type from the unified report API endpoint.
 */
type UnifiedReportResponse = {
  status: api.ReportJobStatus;
  dataUrl?: string;
  metadata?: ReportRef;
};

/**
 * Discriminated union representing all possible report states.
 * Preserved for backward compatibility with existing consumers.
 */
export type ReportState =
  | { type: "loading" }
  | { type: "not-found" }
  | { type: "error"; message: string }
  | { type: "processing"; status: api.ReportJobStatus; metadata?: ReportRef }
  | { type: "ready"; dataUrl: string; metadata?: ReportRef };

/** Terminal states where polling should stop */
const TERMINAL_STATUSES: api.ReportJobStatus[] = [
  "finished",
  "failed",
  "notFound",
];

function isTerminalStatus(status: api.ReportJobStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Fetch report status from the API.
 * Returns a special response for 404 instead of throwing to allow
 * graceful handling of not-found reports.
 *
 * @internal Exported for testing
 */
export async function fetchReport(
  identifier: string,
): Promise<UnifiedReportResponse> {
  const response = await fetchWithRequestId(
    `/api/report/${encodeURIComponent(identifier)}`,
  );

  if (!response.ok) {
    if (response.status === 404) {
      // Return a special response for 404 instead of throwing
      return { status: "notFound" };
    }
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Transform API response and React Query state into the ReportState discriminated union.
 *
 * @internal Exported for testing
 */
export function transformToReportState(
  data: UnifiedReportResponse | undefined,
  isLoading: boolean,
  isError: boolean,
  error: Error | null,
): ReportState {
  // Error state takes precedence (except for 404 which is handled in data)
  if (isError && error) {
    return { type: "error", message: error.message };
  }

  // Still loading initial data
  if (isLoading && !data) {
    return { type: "loading" };
  }

  // No data yet (shouldn't happen but handle gracefully)
  if (!data) {
    return { type: "loading" };
  }

  // Handle specific status values
  if (data.status === "notFound") {
    return { type: "not-found" };
  }

  if (data.status === "finished") {
    if (data.dataUrl) {
      return {
        type: "ready",
        dataUrl: data.dataUrl,
        metadata: data.metadata,
      };
    }
    // Server returned finished but no dataUrl - treat as error
    return { type: "error", message: "Report finished but data URL missing" };
  }

  if (data.status === "failed") {
    return { type: "error", message: "Report generation failed" };
  }

  // Still processing
  return {
    type: "processing",
    status: data.status,
    metadata: data.metadata,
  };
}

/** Polling interval in milliseconds */
const POLLING_INTERVAL = 4000;

/** Stale time for finished reports (10 minutes) */
const FINISHED_STALE_TIME = 10 * 60 * 1000;

/**
 * Hook to fetch and poll for report status using TanStack Query.
 *
 * Features:
 * - Automatic polling every 4 seconds while report is processing
 * - Polling stops automatically when terminal state is reached
 * - Caching with appropriate stale times for different states
 * - Automatic retries with exponential backoff (except for 404s)
 *
 * @param identifier - Firebase document ID or legacy bucket-style URI
 * @returns ReportState discriminated union (backward compatible with original useUnifiedReport)
 */
export function useUnifiedReportQuery(identifier: string): ReportState {
  const { data, isLoading, isError, error } = useQuery<
    UnifiedReportResponse,
    Error
  >({
    queryKey: queryKeys.report.detail(identifier),
    queryFn: () => {
      unifiedReportLogger.debug({ identifier }, "Fetching report status");
      return fetchReport(identifier);
    },

    // Dynamic polling: 4s when processing, stop on terminal states or errors
    refetchInterval: (
      query: Query<UnifiedReportResponse, Error>,
    ): number | false => {
      const currentData = query.state.data;
      const queryStatus = query.state.status;

      // Stop polling on query error
      if (queryStatus === "error") {
        unifiedReportLogger.debug(
          { identifier },
          "Query error, stopping polling",
        );
        return false;
      }

      // No data yet and still pending - poll to get initial status
      if (!currentData) {
        return POLLING_INTERVAL;
      }

      // Terminal state - stop polling
      if (isTerminalStatus(currentData.status)) {
        unifiedReportLogger.debug(
          { identifier, status: currentData.status },
          "Terminal state reached, stopping polling",
        );
        return false;
      }

      // Still processing - continue polling
      unifiedReportLogger.debug(
        { identifier, status: currentData.status },
        "Report processing, continuing to poll",
      );
      return POLLING_INTERVAL;
    },

    // Dynamic stale time based on report state
    staleTime: (query: Query<UnifiedReportResponse, Error>): number => {
      const currentData = query.state.data;
      if (currentData?.status === "finished") {
        return FINISHED_STALE_TIME; // 10 minutes for finished reports
      }
      return 0; // Always fresh for processing reports
    },

    // Retry up to 3 times on errors (React Query default behavior)
    // Note: 404s are handled gracefully in fetchReport by returning { status: "notFound" }
    // rather than throwing, so they don't trigger retries
    retry: 3,
  });

  return transformToReportState(
    data,
    isLoading,
    isError,
    error instanceof Error ? error : null,
  );
}
