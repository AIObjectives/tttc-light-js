import Report from "@src/components/report/Report";
import { getReportDataObj } from "tttc-common/morphisms/pipeline";
import * as schema from "tttc-common/schema";
import * as api from "tttc-common/api";
import { z } from "zod";
import ReportProgresss from "@src/components/reportProgress/ReportProgress";

export default async function ReportPage({
  params,
}: {
  params: { uri: string };
}) {
  const url = decodeURIComponent(params.uri);
  const req = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
  });
  let data = await req.json();
  const maybePipelinedata = schema.llmPipelineOutput.safeParse(data);
  if (maybePipelinedata.success)
    return <Report reportData={getReportDataObj(maybePipelinedata.data)} />;

  // check if data is a data format we recognize as valid input
  const maybePipelineOutput = schema.pipelineOutput.safeParse(data);
  if (maybePipelineOutput.success)
    return <Report reportData={maybePipelineOutput.data[1]} />;
  console.log("here");
  // if not, check if there exists a job and what stage its in.
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
  return <ReportProgresss status={status as api.ReportJobStatus} />;
}
