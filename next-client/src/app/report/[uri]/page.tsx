import Report from "@/components/report/Report";
import { getReportDataObj } from "tttc-common/morphisms/pipeline";
import * as schema from "tttc-common/schema";
import * as api from "tttc-common/api";
import { z } from "zod";
import ReportProgress from "@/components/reportProgress/ReportProgress";
import Feedback from "@/components/feedback/Feedback";

const waitingMessage = z.object({
  message: z.string(),
});

type WaitingStatus = ["status", api.ReportJobStatus];
type ReportData = ["report", schema.UIReportData];
type Error = ["error"];

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
): Promise<WaitingStatus | ReportData | Error> => {
  if (waitingMessage.safeParse(data).success) {
    const statusResponse = await fetch(
      z
        .string()
        .url()
        .parse(
          `${process.env.PIPELINE_EXPRESS_URL}/report/${encodeURIComponent(url)}`,
        ),
    );

    const { status } = await statusResponse
      .json()
      .then(api.getReportResponse.parse);
    return ["status", status as api.ReportJobStatus];
  } else if (schema.llmPipelineOutput.safeParse(data).success) {
    // if the data is from the old schema, then translate it into the new one
    const newSchemaData = getReportDataObj(
      schema.llmPipelineOutput.parse(data),
    );
    return ["report", schema.uiReportData.parse(newSchemaData)];
  } else if (schema.pipelineOutput.safeParse(data).success) {
    return [
      "report",
      schema.uiReportData.parse(schema.pipelineOutput.parse(data).data[1]),
    ];
  } else if (schema.downloadReportSchema.safeParse(data).success) {
    return ["report", schema.downloadReportSchema.parse(data)[1].data[1]];
  } else {
    return ["error"];
  }
};

type PageProps = Promise<{
  uri: string;
}>;

export default async function ReportPage({ params }: { params: PageProps }) {
  const uri = (await params).uri.replace(/\?.*$/, "");
  const encodedUri = encodeURIComponent(decodeURIComponent(uri));
  const baseApiUrl = process.env.PIPELINE_EXPRESS_URL;

  // Fetch status
  const statusUrl = `${baseApiUrl}/report/${encodedUri}/status`;
  const statusRes = await fetch(statusUrl);
  if (!statusRes.ok) {
    return <p>Failed to get report status.</p>;
  }
  const { status } = await statusRes.json();

  if (status !== "finished") {
    return <ReportProgress status={status} />;
  }

  // Fetch signed URL for report data
  const dataUrl = `${baseApiUrl}/report/${encodedUri}/data`;
  const dataRes = await fetch(dataUrl);
  if (!dataRes.ok) {
    return <p>Failed to get signed URL for report, could not download.</p>;
  }
  const { url } = await dataRes.json();

  // Fetch the actual report data from the signed URL
  const req = await fetch(url);
  let data = await req.json();

  const parsedData = await handleResponseData(data, url);

  switch (parsedData[0]) {
    case "status": {
      return <ReportProgress status={parsedData[1]} />;
    }
    case "report": {
      return (
        <div>
          <Report reportData={parsedData[1]} reportUri={url} />
          <Feedback className="hidden lg:block" />
        </div>
      );
    }
    case "error": {
      return <p>An error occurred</p>;
    }
  }
}
