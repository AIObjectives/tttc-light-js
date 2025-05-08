import { NextResponse } from "next/server";
import { getReportDataObj } from "tttc-common/morphisms/pipeline";
import * as schema from "tttc-common/schema";

type ReportData = ["report", schema.UIReportData];
type Error = ["error"];

const handleParsingJson = (data: unknown): ReportData | Error => {
  if (schema.llmPipelineOutput.safeParse(data).success) {
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
  } else if (schema.downloadReportSchema.safeParse(data)) {
    return ["report", schema.downloadReportSchema.parse(data)[1].data[1]];
  } else {
    return ["error"];
  }
};

export async function GET(request: Request) {
  const { pathname } = new URL(request.url);
  const match = pathname.match(/\/api\/report\/download\/(.+)$/);
  const uri = match ? match[1] : undefined;

  if (!uri) {
    return NextResponse.json(
      { error: "Missing URI parameter" },
      { status: 400 },
    );
  }

  const jsonData = await fetch(uri, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  }).then(async (res) => await res.json());

  const parsedJSONData = handleParsingJson(jsonData);

  if (parsedJSONData[0] === "error") {
    return NextResponse.json(
      { error: "Could not parse resource" },
      { status: 500 },
    );
  }

  const downloadableReport: schema.DownloadDataReportSchema = [
    "v0.2",
    {
      data: ["v0.2", parsedJSONData[1]],
      downloadTimestamp: Date.now(),
    },
  ];

  return NextResponse.json(downloadableReport);
}
