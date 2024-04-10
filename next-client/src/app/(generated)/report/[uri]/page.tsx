import { Report } from "src/features/report";

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

  const json = await req.json();

  return <Report data={json} />;
}
