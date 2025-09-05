"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/elements";
import { ReportRef } from "tttc-common/firebase";
import Report from "@/components/report/Report";
import ReportProgress from "@/components/reportProgress/ReportProgress";
import Feedback from "@/components/feedback/Feedback";
import * as schema from "tttc-common/schema";
import * as api from "tttc-common/api";
import * as utils from "tttc-common/utils";
import pRetry from "p-retry";
import { handleResponseData } from "@/lib/report/handleResponseData";
import { logger } from "tttc-common/logger/browser";

const reportLogger = logger.child({ module: "report-by-id" });

interface ReportByIdProps {
  reportId: string;
}

// Clear state types for report loading
type ReportState =
  | { type: "loading" }
  | { type: "not-found" }
  | { type: "rate-limited" }
  | { type: "generating"; jobStatus: api.ReportJobStatus }
  | { type: "ready"; data: schema.UIReportData; url: string }
  | { type: "error"; message: string };

// Type-safe result for metadata fetching
type MetadataResult =
  | { type: "success"; data: ReportRef }
  | { type: "not-found" }
  | { type: "rate-limited" }
  | { type: "error"; message: string };

export default function ReportById({ reportId }: ReportByIdProps) {
  return <ReportByIdContent reportId={reportId} />;
}

function ReportByIdContent({ reportId }: ReportByIdProps) {
  const [state, setState] = useState<ReportState>({ type: "loading" });

  // Reset state when reportId changes
  useEffect(() => {
    setState({ type: "loading" });
  }, [reportId]);

  useEffect(() => {
    loadReport();
  }, [reportId]);

  const loadReport = async () => {
    try {
      // Step 1: Get report metadata from Firebase
      const metadataResult = await fetchReportMetadata(reportId);

      switch (metadataResult.type) {
        case "not-found":
          setState({ type: "not-found" });
          return;
        case "rate-limited":
          setState({ type: "rate-limited" });
          return;
        case "error":
          reportLogger.error(
            { reportId, error: metadataResult.message },
            "Failed to load report due to metadata error",
          );
          setState({ type: "error", message: metadataResult.message });
          return;
        case "success":
          // Continue with the report data
          break;
      }

      const reportRef = metadataResult.data;

      // Step 2: Fetch actual report data
      const reportData = await fetchReportData(reportId);
      if (!reportData.success) {
        setState({ type: "error", message: reportData.error });
        return;
      }

      // Step 3: Process the response
      const result = await processReportData(reportData.data, reportId);

      switch (result.type) {
        case "generating":
          setState({ type: "generating", jobStatus: result.status });
          break;
        case "ready":
          setState({
            type: "ready",
            data: result.data,
            url: reportRef.reportDataUri || "",
          });
          break;
        case "error":
          setState({ type: "error", message: result.message });
          break;
      }
    } catch (error) {
      reportLogger.error({ error }, "Failed to load report");
      setState({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to load report",
      });
    }
  };

  return renderReportState(state);
}

// Separate functions for each step - much clearer!

async function fetchReportMetadata(reportId: string): Promise<MetadataResult> {
  try {
    const response = await fetch(`/api/report/id/${reportId}/metadata`);

    if (!response.ok) {
      if (response.status === 404) {
        reportLogger.info({ reportId }, "Report metadata not found");
        return { type: "not-found" };
      }
      if (response.status === 429) {
        reportLogger.warn(
          { reportId, status: 429 },
          "Rate limited when fetching report metadata",
        );
        return { type: "rate-limited" };
      }
      // Don't hide other errors - propagate them
      reportLogger.error(
        { reportId, status: response.status },
        "Unexpected error fetching report metadata",
      );
      return {
        type: "error",
        message: `Failed to fetch metadata: ${response.status}`,
      };
    }

    const metadata = await response.json();
    reportLogger.debug({ reportId }, "Successfully fetched report metadata");
    return { type: "success", data: metadata as ReportRef };
  } catch (error) {
    reportLogger.error(
      { error, reportId },
      "Network error fetching report metadata",
    );
    return {
      type: "error",
      message: error instanceof Error ? error.message : "Network error",
    };
  }
}

async function fetchReportData(
  reportId: string,
): Promise<{ success: true; data: any } | { success: false; error: string }> {
  const dataUrl = `/api/report/id/${reportId}/data`;

  try {
    const reportData = await pRetry(
      async () => {
        const response = await fetch(dataUrl);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        return response.json();
      },
      {
        retries: 2,
        onFailedAttempt: (error) => {
          reportLogger.debug(
            {
              attemptNumber: error.attemptNumber,
              retriesLeft: error.retriesLeft,
              message: error.message,
            },
            "Report data fetch retry failed",
          );
        },
      },
    );

    // Check for data fetch errors
    if (reportData.type === "reportDataError") {
      return { success: false, error: reportData.message };
    }

    return { success: true, data: reportData };
  } catch (error) {
    reportLogger.error({ error }, "Failed to fetch report data");
    return { success: false, error: "Failed to fetch report data" };
  }
}

async function processReportData(
  reportData: any,
  reportId: string,
): Promise<
  | { type: "generating"; status: api.ReportJobStatus }
  | { type: "ready"; data: schema.UIReportData }
  | { type: "error"; message: string }
> {
  const parsedData = await handleResponseData(reportData, reportId, false);

  switch (parsedData.tag) {
    case "status":
      return { type: "generating", status: parsedData.status };
    case "report":
      return { type: "ready", data: parsedData.data };
    case "error":
      reportLogger.error(
        {
          reportId,
          error: parsedData.message,
          reportData,
        },
        "Report parse error",
      );
      return { type: "error", message: parsedData.message };
    default:
      utils.assertNever(parsedData);
  }
}

function renderReportState(state: ReportState): JSX.Element {
  switch (state.type) {
    case "loading":
      return (
        <div className="w-full h-full content-center justify-items-center">
          <Spinner />
        </div>
      );

    case "not-found":
      return <ReportProgress status="notFound" />;

    case "rate-limited":
      return (
        <div className="w-full h-full content-center justify-items-center">
          <div className="text-center space-y-4">
            <p className="text-orange-600 font-medium">
              Too many requests - please wait a moment before refreshing
            </p>
            <p className="text-sm text-gray-500">
              Rate limiting helps keep our service stable for everyone
            </p>
          </div>
        </div>
      );

    case "generating":
      return <ReportProgress status={state.jobStatus} />;

    case "ready":
      return (
        <div>
          <Report reportData={state.data} reportUri={state.url} />
          <Feedback className="hidden lg:block" />
        </div>
      );

    case "error":
      return (
        <div className="w-full h-full content-center justify-items-center">
          <p className="text-red-500">{state.message}</p>
        </div>
      );

    default:
      utils.assertNever(state);
  }
}
