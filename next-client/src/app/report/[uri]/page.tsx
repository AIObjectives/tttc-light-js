import Report from "@/components/report/Report";
import * as schema from "tttc-common/schema";
import * as api from "tttc-common/api";
import * as utils from "tttc-common/utils";
import ReportProgress from "@/components/reportProgress/ReportProgress";
import Feedback from "@/components/feedback/Feedback";
import pRetry from "p-retry";
import { logger } from "tttc-common/logger/browser";
import LegacyReportWrapper from "@/components/report/LegacyReportWrapper";
import { handleResponseData } from "@/lib/report/handleResponseData";

const reportPageLogger = logger.child({ module: "report-page" });

type NotFoundState = { type: "notFound" };
type ProgressState = { type: "progress"; status: api.ReportJobStatus };
type ErrorState = { type: "error"; message: string };
type ReportDataState = {
  type: "reportData";
  data: schema.UIReportData;
  rawPipelineOutput: schema.PipelineOutput;
  url: string;
};
type ReportDataErrorState = { type: "reportDataError"; message: string };

async function getReportState(
  encodedUri: string,
): Promise<
  | NotFoundState
  | ProgressState
  | ErrorState
  | ReportDataState
  | ReportDataErrorState
> {
  const baseApiUrl = process.env.PIPELINE_EXPRESS_URL ?? "";
  const unifiedUrl = `${baseApiUrl}/report/${encodedUri}`;

  try {
    const reportResponse = await pRetry(
      async () => {
        const response = await fetch(unifiedUrl);
        if (!response.ok) {
          if (response.status === 404) {
            return { notFound: true };
          }
          throw new Error(`Failed to fetch report: ${response.status}`);
        }
        return await response.json();
      },
      {
        retries: 2,
        onFailedAttempt: (error) => {
          reportPageLogger.warn(
            {
              attemptNumber: error.attemptNumber,
              retriesLeft: error.retriesLeft,
            },
            "Failed to fetch report, retrying",
          );
        },
      },
    );

    if (reportResponse.notFound) {
      return { type: "notFound" };
    }

    const status = reportResponse.status as api.ReportJobStatus;

    if (status === "failed") {
      return { type: "progress", status };
    }
    if (status && status !== "finished" && status !== "notFound") {
      return { type: "progress", status };
    }

    // If finished, we should have a dataUrl
    if (status === "finished" && reportResponse.dataUrl) {
      // Fetch the actual report data from the signed URL
      const reportData = await pRetry(
        async () => {
          const reportRes = await fetch(reportResponse.dataUrl);
          if (!reportRes.ok) {
            throw new Error(
              `Failed to fetch report data from storage: ${reportRes.status}`,
            );
          }
          return await reportRes.json();
        },
        {
          retries: 2,
          onFailedAttempt: (error) => {
            reportPageLogger.warn(
              {
                attemptNumber: error.attemptNumber,
                retriesLeft: error.retriesLeft,
              },
              "Failed to fetch report data, retrying",
            );
          },
        },
      );

      // Parse the raw pipeline output first
      const rawPipelineOutput = schema.pipelineOutput.parse(reportData);

      // Process the report data for UI rendering
      const result = await handleResponseData(reportData, encodedUri, true);

      if (result.tag === "report") {
        return {
          type: "reportData",
          data: result.data,
          rawPipelineOutput,
          url: reportResponse.dataUrl,
        };
      } else if (result.tag === "error") {
        return { type: "reportDataError", message: result.message };
      } else {
        // This shouldn't happen with the unified endpoint
        return { type: "progress", status: result.status };
      }
    }

    return { type: "notFound" };
  } catch (error) {
    reportPageLogger.error(
      {
        unifiedUrl,
        error,
      },
      "Failed to fetch report",
    );
    return {
      type: "error",
      message:
        error instanceof Error ? error.message : "Failed to fetch report",
    };
  }
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ uri: string }>;
}) {
  const { uri } = await params;
  const encodedUri = encodeURIComponent(decodeURIComponent(uri)); // This is probably overly strict now.

  // Wrap the entire page in LegacyReportWrapper for migration handling
  return (
    <LegacyReportWrapper uri={uri}>
      <ReportPageContent encodedUri={encodedUri} />
    </LegacyReportWrapper>
  );
}

async function ReportPageContent({ encodedUri }: { encodedUri: string }) {
  const state = await getReportState(encodedUri);

  switch (state.type) {
    case "notFound":
      return <ReportProgress status="notFound" />;
    case "progress":
      return <ReportProgress status={state.status} identifier={encodedUri} />;
    case "error":
      return <p>{state.message}</p>;
    case "reportData":
      return (
        <div>
          <Report
            reportData={state.data}
            reportUri={state.url}
            rawPipelineOutput={state.rawPipelineOutput}
          />
          <Feedback className="hidden lg:block" />
        </div>
      );
    case "reportDataError":
      return <p>{state.message}</p>;
    default:
      utils.assertNever(state);
  }
}
