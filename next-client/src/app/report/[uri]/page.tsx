import Report from "@src/components/report/Report";
import { getReportDataObj } from "tttc-common/morphisms/pipeline";
import * as schema from "tttc-common/schema";
import * as api from "tttc-common/api";
import { z } from "zod";
import ReportProgresss from "@src/components/reportProgress/ReportProgress";

const waitingMessage = z.object({
  message: z.string(),
});

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
    return <ReportProgresss status={status as api.ReportJobStatus} />;
  }

  const reportData = schema.llmPipelineOutput.safeParse(data).success
    ? getReportDataObj(data)
    : schema.pipelineOutput.parse(data).data[1];
  return <Report reportData={reportData} />;
}
