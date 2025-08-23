"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/elements";
import { getFirebaseDb } from "@/lib/firebase/clientApp";
import { doc, getDoc } from "firebase/firestore";
import { useGetCollectionName, ReportRef } from "tttc-common/firebase";
import Report from "@/components/report/Report";
import ReportProgress from "@/components/reportProgress/ReportProgress";
import Feedback from "@/components/feedback/Feedback";
import * as schema from "tttc-common/schema";
import * as api from "tttc-common/api";
import * as utils from "tttc-common/utils";
import pRetry from "p-retry";
import { handleResponseData } from "@/lib/report/handleResponseData";

interface ReportByIdProps {
  reportId: string;
}

const NODE_ENV =
  process.env.NODE_ENV === "production" ? "production" : "development";
const getCollectionName = useGetCollectionName(NODE_ENV);

// Clear state types for report loading
type ReportState =
  | { type: "loading" }
  | { type: "not-found" }
  | { type: "generating"; jobStatus: api.ReportJobStatus }
  | { type: "ready"; data: schema.UIReportData; url: string }
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
      const reportRef = await fetchReportMetadata(reportId);
      if (!reportRef) {
        setState({ type: "not-found" });
        return;
      }

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
      console.error("Failed to load report:", error);
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

async function fetchReportMetadata(
  reportId: string,
): Promise<ReportRef | null> {
  const db = getFirebaseDb();
  const docRef = doc(db, getCollectionName("REPORT_REF"), reportId);
  const docSnap = await getDoc(docRef);

  return docSnap.exists() ? (docSnap.data() as ReportRef) : null;
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
          console.log(
            `Retry ${error.attemptNumber}/${error.retriesLeft + error.attemptNumber} failed:`,
            error.message,
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
    console.error("Failed to fetch report data:", error);
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
      console.error("Report parse error:", {
        reportId,
        error: parsedData.message,
        reportData,
      });
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
