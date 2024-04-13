import { Report } from "src/features/report";
import { pipelineOutput } from "tttc-common/schema";
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
  const json = pipelineOutput.parse(data);
  return <Report data={json} />;
}
