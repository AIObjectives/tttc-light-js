"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as api from "tttc-common/api";
import * as schema from "tttc-common/schema";
import { useUserQuery } from "@/lib/query/useUserQuery";
import { handleResponseData } from "@/lib/report/handleResponseData";
import Feedback from "../feedback/Feedback";
import ReportProgress from "../reportProgress/ReportProgress";
import Report from "./Report";
import { ReportErrorState } from "./ReportErrorState";

interface PrivateReportGuardProps {
  reportId: string;
}

/**
 * Retry configuration for handling transient 404 responses.
 *
 * Rationale:
 * - MAX_RETRIES = 2: Allows up to 2 retry attempts after the initial request
 *   Total attempts = 3 (initial + 2 retries)
 * - RETRY_DELAY_MS = 1000: 1 second delay between retries
 *   Total max wait time = 2 seconds (2 retries × 1 second)
 *
 * Why we need retries:
 * 1. SSR race condition: Server-side renders may return 404 before client auth is available
 * 2. Firestore eventual consistency: Newly created reports may not be immediately readable
 * 3. Network glitches: Transient network issues that resolve quickly
 *
 * Why these specific values:
 * - 2 retries is sufficient for most transient issues without excessive delay
 * - 1 second delay balances responsiveness with giving systems time to converge
 * - Total 2-second max wait is acceptable UX for private report access
 */
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

type LoadingState = { type: "loading" };
type NotFoundState = { type: "notFound" };
type ProgressState = { type: "progress"; status: api.ReportJobStatus };
type ErrorState = { type: "error"; message: string };
type ReportDataState = {
  type: "reportData";
  data: schema.UIReportData;
  rawPipelineOutput: schema.PipelineOutput;
  url: string;
};

type State =
  | LoadingState
  | NotFoundState
  | ProgressState
  | ErrorState
  | ReportDataState;

/**
 * Check if a report status indicates it's still in progress.
 */
function isInProgressStatus(status: api.ReportJobStatus | undefined): boolean {
  if (!status) return false;
  return status !== "finished" && status !== "notFound";
}

/**
 * Convert handleResponseData result to component state.
 */
function convertResultToState(
  result: Awaited<ReturnType<typeof handleResponseData>>,
  rawPipelineOutput: schema.PipelineOutput,
  url: string,
): State {
  if (result.tag === "report") {
    return {
      type: "reportData",
      data: result.data,
      rawPipelineOutput,
      url,
    };
  }
  if (result.tag === "error") {
    return { type: "error", message: result.message };
  }
  return { type: "progress", status: result.status };
}

/**
 * Process report data that's already included in the response.
 */
async function processIncludedReportData(
  reportData: unknown,
  reportId: string,
  dataUrl: string,
): Promise<State> {
  const rawPipelineOutput = schema.pipelineOutput.parse(reportData);
  const result = await handleResponseData(reportData, reportId, true);
  return convertResultToState(result, rawPipelineOutput, dataUrl);
}

/**
 * Fetch and process report data from a URL.
 */
async function fetchAndProcessReportData(
  dataUrl: string,
  reportId: string,
): Promise<State> {
  const reportDataResponse = await fetch(dataUrl);
  if (!reportDataResponse.ok) {
    return {
      type: "error",
      message: `Failed to fetch report data: ${reportDataResponse.status}`,
    };
  }

  const reportData = await reportDataResponse.json();
  const rawPipelineOutput = schema.pipelineOutput.parse(reportData);
  const result = await handleResponseData(reportData, reportId, true);
  return convertResultToState(result, rawPipelineOutput, dataUrl);
}

/**
 * Process the report response and convert to component state.
 */
async function processReportResponse(
  reportResponse: {
    status?: api.ReportJobStatus;
    reportData?: unknown;
    dataUrl?: string;
  },
  reportId: string,
): Promise<State> {
  const status = reportResponse.status;

  // Handle in-progress or failed states
  if (status === "failed" || isInProgressStatus(status)) {
    return { type: "progress", status: status as api.ReportJobStatus };
  }

  // Handle finished report - return early if not finished
  if (status !== "finished") {
    return { type: "notFound" };
  }

  // Try to use included report data first (server-side fetch avoids CORS)
  if (reportResponse.reportData) {
    return processIncludedReportData(
      reportResponse.reportData,
      reportId,
      reportResponse.dataUrl ?? "",
    );
  }

  // Fallback: fetch from dataUrl (may encounter CORS issues)
  if (reportResponse.dataUrl) {
    return fetchAndProcessReportData(reportResponse.dataUrl, reportId);
  }

  return { type: "notFound" };
}

/**
 * Client-side guard that retries fetching a report with authentication.
 * Used when SSR returns "notFound" - the report might be private and
 * accessible to the authenticated owner.
 */
export function PrivateReportGuard({ reportId }: PrivateReportGuardProps) {
  const { user, loading: authLoading } = useUserQuery();
  const [state, setState] = useState<State>({ type: "loading" });
  const [hasTriedAuth, setHasTriedAuth] = useState(false);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);

  // Fetch with retry logic for transient 404s
  const fetchWithRetry = useCallback(
    async (
      currentUser: NonNullable<typeof user>,
      isMountedRef: { current: boolean },
    ) => {
      try {
        const token = await currentUser.getIdToken();

        // Retry loop instead of recursion to avoid premature finally block execution
        let attempt = 0;
        while (attempt <= MAX_RETRIES) {
          const response = await fetch(
            `/api/report/${reportId}?includeData=true`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );

          if (!response.ok) {
            // On 404, retry up to MAX_RETRIES times for transient failures
            if (response.status === 404 && attempt < MAX_RETRIES) {
              attempt += 1;
              retryCountRef.current = attempt;
              await new Promise((resolve) =>
                setTimeout(resolve, RETRY_DELAY_MS),
              );
              // Check if component is still mounted before retrying
              if (!isMountedRef.current) return;
              continue; // Retry
            }

            if (!isMountedRef.current) return;
            setState(
              response.status === 404
                ? { type: "notFound" }
                : {
                    type: "error",
                    message: `Failed to fetch report: ${response.status}`,
                  },
            );
            return;
          }

          // Success - process the response
          const reportResponse = await response.json();
          const newState = await processReportResponse(
            reportResponse,
            reportId,
          );
          if (!isMountedRef.current) return;
          setState(newState);
          return;
        }
      } catch (error) {
        if (!isMountedRef.current) return;
        setState({
          type: "error",
          message:
            error instanceof Error ? error.message : "Failed to fetch report",
        });
      } finally {
        if (isMountedRef.current) {
          setHasTriedAuth(true);
        }
      }
    },
    [reportId],
  );

  useEffect(() => {
    // Track mounted state for cleanup
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Reset retry counter when user changes to prevent stale retry state
    retryCountRef.current = 0;

    if (authLoading) {
      return;
    }

    if (!user) {
      setState({ type: "notFound" });
      return;
    }

    if (hasTriedAuth) {
      return;
    }

    fetchWithRetry(user, isMountedRef);
  }, [user, authLoading, hasTriedAuth, fetchWithRetry]);

  switch (state.type) {
    case "loading":
      return (
        <div className="flex h-[50vh] items-center justify-center">
          <div className="text-muted-foreground">Checking access...</div>
        </div>
      );
    case "notFound":
      return <ReportErrorState type="notFound" />;
    case "progress":
      return <ReportProgress status={state.status} identifier={reportId} />;
    case "error":
      return <ReportErrorState type="loadError" message={state.message} />;
    case "reportData":
      return (
        <div>
          <Report
            reportData={state.data}
            reportUri={state.url}
            rawPipelineOutput={state.rawPipelineOutput}
            reportId={reportId}
          />
          <Feedback className="hidden lg:block" />
        </div>
      );
  }
}
