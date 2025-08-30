import Report from "@/components/report/Report";
import * as schema from "tttc-common/schema";
import * as api from "tttc-common/api";
import * as utils from "tttc-common/utils";
import { z } from "zod";
import ReportProgress from "@/components/reportProgress/ReportProgress";
import Feedback from "@/components/feedback/Feedback";
import pRetry from "p-retry";
import { logger } from "tttc-common/logger/browser";
import LegacyReportWrapper from "@/components/report/LegacyReportWrapper";
import { handleResponseData } from "@/lib/report/handleResponseData";

const reportPageLogger = logger.child({ module: "report-page" });

const waitingMessage = z.object({
  message: z.string(),
});

type NotFoundState = { type: "notFound" };
type ProgressState = { type: "progress"; status: api.ReportJobStatus };
type ErrorState = { type: "error"; message: string };
type ReportDataState = {
  type: "reportData";
  data: schema.UIReportData;
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
  const statusUrl = `${baseApiUrl}/report/${encodedUri}/status`;
  try {
    const statusJson = await pRetry(
      async () => {
        const statusRes = await fetch(statusUrl);
        if (!statusRes.ok) {
          throw new Error(`Failed to fetch report status: ${statusRes.status}`);
        }
        return await statusRes.json();
      },
      {
        retries: 2,
        onFailedAttempt: (error) => {
          reportPageLogger.warn(
            {
              attemptNumber: error.attemptNumber,
              retriesLeft: error.retriesLeft,
            },
            "Failed to fetch report status, retrying",
          );
        },
      },
    ).catch((error) => {
      reportPageLogger.error(
        {
          statusUrl,
          error,
        },
        "Failed to fetch report status",
      );
      return { type: "error", message: "Failed to fetch report status." };
    });

    if (statusJson.type === "error") {
      return statusJson;
    }
    const status = statusJson.status as api.ReportJobStatus;

    if (status === "failed") {
      return { type: "progress", status };
    }
    if (status && status !== "finished" && status !== "notFound") {
      return { type: "progress", status };
    }

    // Fetch either signed or fallback URL for report data
    const dataUrl = `${baseApiUrl}/report/${encodedUri}/data`;
    const dataJson = await pRetry(
      async () => {
        const dataRes = await fetch(dataUrl);
        if (!dataRes.ok) {
          throw new Error(`Failed to fetch report data URL: ${dataRes.status}`);
        }
        return await dataRes.json();
      },
      {
        retries: 2,
        onFailedAttempt: (error) => {
          console.log(
            `Failed to fetch report data URL. Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`,
          );
        },
      },
    ).catch((error) => {
      console.error("Failed to fetch report data URL", {
        dataUrl,
        error,
      });
      return {
        type: "error",
        message:
          "Failed to fetch report data. The file may not be public, may not exist, or you may not have access.",
      };
    });

    if (dataJson.type === "error") {
      return dataJson;
    }

    const url = dataJson.url as string | undefined;
    if (url === undefined) {
      console.error("Failed to get report data URL", {
        dataUrl,
        dataJson,
      });
      return {
        type: "error",
        message:
          "Failed to fetch report data. The file may not be public, may not exist, or you may not have access.",
      };
    }

    // Fetch the actual report data
    try {
      const reportData = await pRetry(
        async () => {
          const reportRes = await fetch(url);
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
            console.log(
              `Failed to fetch report data from storage. Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`,
            );
          },
        },
      ).catch((error) => {
        console.error("Failed to fetch report data from storage", {
          url,
          error,
        });
        return {
          type: "reportDataError",
          message:
            "Failed to fetch report data. The file may not be public or may not exist.",
        };
      });

      if (reportData.type === "reportDataError") {
        return reportData;
      }
      const parsedData = await handleResponseData(reportData, url, true);

      switch (parsedData.tag) {
        case "status":
          return { type: "progress", status: parsedData.status };
        case "report":
          return { type: "reportData", data: parsedData.data, url: url };
        case "error":
          console.error("Report data parse error", { url, reportData });
          return { type: "reportDataError", message: parsedData.message };
        default:
          utils.assertNever(parsedData);
      }
    } catch (e) {
      console.error("Exception while fetching or parsing report data", {
        url,
        error: e,
      });
      return {
        type: "reportDataError",
        message:
          "Failed to fetch report data. The file may not be public or may not exist.",
      };
    }
  } catch (e) {
    console.error("Unexpected error loading report", { statusUrl, error: e });
    return { type: "error", message: "Unexpected error loading report." };
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
      return <ReportProgress status={state.status} />;
    case "error":
      return <p>{state.message}</p>;
    case "reportData":
      return (
        <div>
          <Report reportData={state.data} reportUri={state.url} />
          <Feedback className="hidden lg:block" />
        </div>
      );
    case "reportDataError":
      return <p>{state.message}</p>;
    default:
      utils.assertNever(state);
  }
}
