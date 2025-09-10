import { useState, useEffect, useCallback } from "react";
import { ReportRef } from "tttc-common/firebase";
import * as api from "tttc-common/api";
import { logger } from "tttc-common/logger/browser";

const unifiedReportLogger = logger.child({ module: "unified-report-hook" });

type UnifiedReportResponse = {
  status: api.ReportJobStatus;
  dataUrl?: string;
  metadata?: ReportRef;
};

type ReportState =
  | { type: "loading" }
  | { type: "not-found" }
  | { type: "error"; message: string }
  | { type: "processing"; status: api.ReportJobStatus; metadata?: ReportRef }
  | { type: "ready"; dataUrl: string; metadata?: ReportRef };

export function useUnifiedReport(identifier: string) {
  const [state, setState] = useState<ReportState>({ type: "loading" });

  const fetchReport = useCallback(async () => {
    try {
      // Use Next.js API route which proxies to Express server
      const response = await fetch(
        `/api/report/${encodeURIComponent(identifier)}`,
      );

      if (!response.ok) {
        if (response.status === 404) {
          setState({ type: "not-found" });
          return;
        }
        const errorText = await response.text();
        setState({
          type: "error",
          message: `HTTP ${response.status}: ${errorText}`,
        });
        return;
      }

      const data: UnifiedReportResponse = await response.json();

      unifiedReportLogger.debug(
        { status: data.status, identifier },
        "Fetched report status",
      );

      if (data.status === "finished" && data.dataUrl) {
        setState({
          type: "ready",
          dataUrl: data.dataUrl,
          metadata: data.metadata,
        });
      } else if (data.status === "failed") {
        setState({ type: "error", message: "Report generation failed" });
      } else {
        // Still processing
        setState({
          type: "processing",
          status: data.status,
          metadata: data.metadata,
        });
      }
    } catch (error) {
      setState({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to fetch report",
      });
    }
  }, [identifier]);

  // Initial fetch on mount
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Set up polling when report is processing
  useEffect(() => {
    if (state.type === "processing") {
      unifiedReportLogger.debug(
        { identifier, status: state.status },
        "Starting polling",
      );
      const interval = setInterval(fetchReport, 4000); // 4 seconds for responsive polling
      return () => {
        unifiedReportLogger.debug({ identifier }, "Stopping polling");
        clearInterval(interval);
      };
    }
  }, [fetchReport, state.type, identifier]);

  return state;
}
