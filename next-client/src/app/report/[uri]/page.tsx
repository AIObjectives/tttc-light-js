import Report from "@/components/report/Report";
import { getReportDataObj } from "tttc-common/morphisms/pipeline";
import * as schema from "tttc-common/schema";
import * as api from "tttc-common/api";
import * as utils from "tttc-common/utils";
import { z } from "zod";
import ReportProgress from "@/components/reportProgress/ReportProgress";
import Feedback from "@/components/feedback/Feedback";
import pRetry from "p-retry";
import { logger } from "tttc-common/logger/browser";

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

type HandleResponseResult =
  | { tag: "status"; status: api.ReportJobStatus }
  | { tag: "report"; data: schema.UIReportData }
  | { tag: "error"; message: string };

/**
 * When the data resource is fetched, we want to read it and decide how to handle it.
 *
 * - Waiting message: If it looks like the job hasn't finished, then ping the server and see if we can
 * determine its job status
 *
 * - Old schema: If the report data was generated prior to the introduction of v2 schema, then we need to
 * run it through a function that maps the data to the current schema
 *
 * - TODO Downloaded report schema
 *
 * - Current schema: we can just return this
 */
const handleResponseData = async (
  data: unknown,
  url: string,
): Promise<HandleResponseResult> => {
  try {
    if (waitingMessage.safeParse(data).success) {
      const { status } = await pRetry(
        async () => {
          const response = await fetch(
            z
              .string()
              .url()
              .parse(
                `${process.env.PIPELINE_EXPRESS_URL}/report/${encodeURIComponent(url)}`,
              ),
          );
          const json = await response.json();
          return api.getReportResponse.parse(json);
        },
        {
          retries: 2,
          onFailedAttempt: (error) => {
            reportPageLogger.warn(
              {
                attemptNumber: error.attemptNumber,
                retriesLeft: error.retriesLeft,
              },
              "Failed to fetch status response, retrying",
            );
          },
        },
      );
      return { tag: "status", status: status as api.ReportJobStatus };
    } else if (schema.llmPipelineOutput.safeParse(data).success) {
      // if the data is from the old schema, then translate it into the new one
      const newSchemaData = getReportDataObj(
        schema.llmPipelineOutput.parse(data),
      );
      return { tag: "report", data: schema.uiReportData.parse(newSchemaData) };
    } else if (schema.pipelineOutput.safeParse(data).success) {
      return {
        tag: "report",
        data: schema.uiReportData.parse(
          schema.pipelineOutput.parse(data).data[1],
        ),
      };
    } else if (schema.downloadReportSchema.safeParse(data).success) {
      return {
        tag: "report",
        data: schema.downloadReportSchema.parse(data)[1].data[1],
      };
    } else {
      return { tag: "error", message: "Unknown error" };
    }
  } catch (e) {
    reportPageLogger.error(
      {
        url,
        error: e,
      },
      "Unexpected error in handleResponseData",
    );
    return { tag: "error", message: "Failed to process response data" };
  }
};

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
      const parsedData = await handleResponseData(reportData, url);

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
