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

// Max retries for transient 404s (e.g., network glitches, Firestore replication delay)
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

  // Handle finished report
  if (status === "finished") {
    // Check if report data is already included (server-side fetch to avoid CORS)
    if (reportResponse.reportData) {
      const reportData = reportResponse.reportData;
      const rawPipelineOutput = schema.pipelineOutput.parse(reportData);
      const result = await handleResponseData(reportData, reportId, true);

      if (result.tag === "report") {
        return {
          type: "reportData",
          data: result.data,
          rawPipelineOutput,
          url: reportResponse.dataUrl ?? "",
        };
      }
      if (result.tag === "error") {
        return { type: "error", message: result.message };
      }
      return { type: "progress", status: result.status };
    }

    // Fallback: fetch from dataUrl (may encounter CORS issues)
    if (reportResponse.dataUrl) {
      const reportDataResponse = await fetch(reportResponse.dataUrl);
      if (!reportDataResponse.ok) {
        return {
          type: "error",
          message: `Failed to fetch report data: ${reportDataResponse.status}`,
        };
      }

      const reportData = await reportDataResponse.json();
      const rawPipelineOutput = schema.pipelineOutput.parse(reportData);
      const result = await handleResponseData(reportData, reportId, true);

      if (result.tag === "report") {
        return {
          type: "reportData",
          data: result.data,
          rawPipelineOutput,
          url: reportResponse.dataUrl,
        };
      }
      if (result.tag === "error") {
        return { type: "error", message: result.message };
      }
      return { type: "progress", status: result.status };
    }
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

  // Fetch with retry logic for transient 404s
  const fetchWithRetry = useCallback(
    async (currentUser: NonNullable<typeof user>) => {
      try {
        const token = await currentUser.getIdToken();
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
          if (response.status === 404 && retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current += 1;
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
            return fetchWithRetry(currentUser);
          }

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

        const reportResponse = await response.json();
        console.log("[PrivateReportGuard] Received response:", {
          hasReportData: !!reportResponse.reportData,
          hasDataUrl: !!reportResponse.dataUrl,
          status: reportResponse.status,
        });
        const newState = await processReportResponse(reportResponse, reportId);
        setState(newState);
      } catch (error) {
        setState({
          type: "error",
          message:
            error instanceof Error ? error.message : "Failed to fetch report",
        });
      } finally {
        setHasTriedAuth(true);
      }
    },
    [reportId],
  );

  useEffect(() => {
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

    fetchWithRetry(user);
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
