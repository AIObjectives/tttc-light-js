import Report from "@src/components/report/Report";
import { getReportDataObj } from "tttc-common/morphisms/pipeline";
import * as schema from "tttc-common/schema";

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
    cache: "no-cache",
  });
  let data = await req.json();
  const reportData = schema.llmPipelineOutput.safeParse(data).success
    ? getReportDataObj(data)
    : schema.pipelineOutput.parse(data).data[1];

  return (
    // <div className="flex w-full justify-center">

    <Report reportData={reportData} />
    // </div>
  );
}
