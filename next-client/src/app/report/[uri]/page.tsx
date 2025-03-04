import Report from "@/components/report/Report";
import { getReportDataObj } from "tttc-common/morphisms/pipeline";
import * as schema from "tttc-common/schema";
import * as api from "tttc-common/api";
import { z } from "zod";
import ReportProgresss from "@/components/reportProgress/ReportProgress";
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
  const url = decodeURIComponent(uri);
  const req = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
  });
  let data = await req.json();

  const parsedData = await handleResponseData(data, url);

  switch (parsedData[0]) {
    case "status": {
      return <ReportProgresss status={parsedData[1]} />;
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
      return <p>An error occured</p>;
    }
  }
}
