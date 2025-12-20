"use client";

import React from "react";
import type * as api from "tttc-common/api";
import { logger } from "tttc-common/logger/browser";
import { ReportErrorState } from "@/components/report/ReportErrorState";
import { useUnifiedReport } from "@/hooks/useUnifiedReport";
import { Progress } from "../elements";
import { Col } from "../layout";

const reportProgressLogger = logger.child({ module: "report-progress" });

export default function ReportProgress({
  status,
  identifier,
}: {
  status: api.ReportJobStatus;
  identifier?: string;
}) {
  // Only use client-side polling for processing reports and if we have an identifier
  const shouldPoll =
    identifier && !["finished", "failed", "notFound"].includes(status);
  // biome-ignore lint/correctness/useHookAtTopLevel: conditional hook is intentional - shouldPoll is stable per render cycle
  const reportState = shouldPoll ? useUnifiedReport(identifier) : null;

  // Determine current status
  const currentStatus: api.ReportJobStatus =
    reportState?.type === "processing"
      ? reportState.status
      : reportState?.type === "error"
        ? "failed"
        : reportState?.type === "not-found"
          ? "notFound"
          : reportState?.type === "loading"
            ? "queued"
            : status; // Fallback to initial server status

  // Auto-reload when report is ready
  React.useEffect(() => {
    if (reportState?.type === "ready") {
      window.location.reload();
    }
  }, [reportState?.type]);

  return (
    <Col className="w-full h-full flex-grow items-center justify-center">
      <StatusDisplay status={currentStatus} />
    </Col>
  );
}

const StatusDisplay = ({ status }: { status: api.ReportJobStatus }) => {
  switch (status) {
    case "failed":
      return <ReportErrorState type="failed" />;
    case "finished":
      // Report finished but data not found - likely moved or deleted
      return <ReportErrorState type="notFound" />;
    case "notFound":
      return <ReportErrorState type="notFound" />;
    default:
      return <ReportProcessing status={status} />;
  }
};

function ReportProcessing({ status }: { status: api.ReportJobStatus }) {
  return (
    <>
      <Progress value={statusToProgress(status)} className="w-[60%]" />
      <p>{statusMessage(status)}</p>
    </>
  );
}

const statusToProgress = (status: api.ReportJobStatus) => {
  switch (status) {
    case "queued":
      return 0;
    case "clustering":
      return 20;
    case "extraction":
      return 40;
    case "sorting":
      return 50;
    case "dedup":
      return 60;
    case "summarizing":
      return 70;
    case "wrappingup":
      return 80;
    case "scoring_bridging":
      return 90;
    case "finished":
      return 100;
    case "failed":
      throw new Error(`Report creation failed`);
    case "notFound":
      return -100;
    default: {
      // Log unexpected status instead of crashing
      reportProgressLogger.warn({ status }, "Unexpected status");
      return 5; // Default progress for unknown statuses
    }
  }
};

const statusMessage = (status: api.ReportJobStatus) => {
  switch (status) {
    case "queued":
      return "Your report is queued...";
    case "clustering":
      return "Clustering arguments...";
    case "extraction":
      return "Extracting claims...";
    case "sorting":
      return "Sorting claims";
    case "dedup":
      return "Removing duplicates...";
    case "summarizing":
      return "Generating topic summaries...";
    case "wrappingup":
      return "Wrapping up...";
    case "scoring_bridging":
      return "Scoring content for bridging potential...";
    case "finished":
      return "Report complete!";
    case "failed":
      return "Report failed :(";
    case "notFound":
      return "Not found :/";
    default: {
      reportProgressLogger.warn({ status }, "Unexpected status message");
      return "Processing...";
    }
  }
};
