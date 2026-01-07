import pRetry from "p-retry";
import * as api from "tttc-common/api";
import * as schema from "tttc-common/schema";
import { getReportDataObj } from "tttc-common/transforms";
import { z } from "zod";

const waitingMessage = z.object({
  message: z.string(),
});

export type HandleResponseResult =
  | { tag: "status"; status: api.ReportJobStatus }
  | { tag: "report"; data: schema.UIReportData }
  | { tag: "error"; message: string };

/**
 * Handles parsing of report data from various schema formats
 *
 * When the data resource is fetched, we want to read it and decide how to handle it:
 * - Waiting message: If it looks like the job hasn't finished, then ping the server and see if we can
 *   determine its job status
 * - Old schema: If the report data was generated prior to the introduction of v2 schema, then we need to
 *   run it through a function that maps the data to the current schema
 * - Current schema: we can just return this
 */
export const handleResponseData = async (
  data: unknown,
  identifier: string,
  isLegacyUrl: boolean = false,
): Promise<HandleResponseResult> => {
  try {
    if (waitingMessage.safeParse(data).success) {
      const statusUrl = `${process.env.PIPELINE_EXPRESS_URL}/report/${encodeURIComponent(identifier)}`;

      const { status } = await pRetry(
        async () => {
          const response = await fetch(statusUrl);
          const json = await response.json();
          return api.getReportResponse.parse(json);
        },
        {
          retries: 2,
          onFailedAttempt: (error) => {
            console.log(
              `Failed to fetch status response. Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`,
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
    console.error("Unexpected error in handleResponseData", {
      identifier,
      isLegacyUrl,
      error: e,
    });
    return { tag: "error", message: "Failed to process response data" };
  }
};
