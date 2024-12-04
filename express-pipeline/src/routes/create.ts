import "dotenv/config";
import { Request, Response } from "express";
import { fetchSpreadsheetData } from "../googlesheet";
import pipeline from "../pipeline";
import { getStorageUrl, storeJSON } from "../storage";
import * as api from "tttc-common/api";
import * as schema from "tttc-common/schema";
import { formatData, uniqueSlug } from "../utils";
import { pipelineQueue } from "../Queue";
import { pipeLineWorker } from "worker";

const handleGoogleSheets = async (
  googleData: schema.GoogleSheetData,
): Promise<{ data: schema.SourceRow[]; pieCharts: schema.LLMPieChart[] }> => {
  const { data, pieCharts } = await fetchSpreadsheetData(
    googleData.url,
    googleData.pieChartColumns,
    googleData.filterEmails,
    googleData.oneSubmissionPerEmail,
  );

  return {
    data: formatData(data),
    pieCharts,
  };
};

const handleCsvData = async (csvData: schema.SourceRow[]) => ({
  data: formatData(csvData),
});

const parseData = async (
  data: schema.DataPayload,
): Promise<{ data: schema.SourceRow[]; pieChart?: schema.LLMPieChart[] }> => {
  switch (data[0]) {
    case "csv":
      return await handleCsvData(data[1]);
    case "googlesheet":
      return await handleGoogleSheets(data[1]);
    default: {
      throw new Error("Unrecognized data payload");
    }
  }
};

async function createNewReport(req: Request, res: Response) {
  const { CLIENT_BASE_URL, OPENAI_API_KEY, OPENAI_API_KEY_PASSWORD } =
    req.context.env;
  const body = api.generateApiRequest.parse(req.body);
  const { data, userConfig } = body;
  const parsedData = await parseData(data);
  const filename = uniqueSlug(userConfig.title);
  const jsonUrl = getStorageUrl(filename);
  await storeJSON(
    filename,
    JSON.stringify({ message: "Your data is being generated" }),
  );
  const reportUrl = new URL(
    `report/${encodeURIComponent(jsonUrl)}`,
    CLIENT_BASE_URL,
  ).toString();

  const response: api.GenerateApiResponse = {
    message: "Request received.",
    filename: filename,
    jsonUrl,
    reportUrl,
  };
  res.send(response);
  // if user provided key is the same as our password, let them use our key
  const apiKey =
    userConfig.apiKey === OPENAI_API_KEY_PASSWORD
      ? OPENAI_API_KEY
      : userConfig.apiKey;
  const config: schema.OldOptions = {
    ...userConfig,
    ...parsedData,
    filename,
    apiKey,
  };

  const job = await pipelineQueue.add(
    "pipeline",
    { config },
    { jobId: config.filename },
  );
}

export default async function create(req: Request, res: Response) {
  try {
    return createNewReport(req, res);
  } catch (e) {
    console.error(e);

    res.status(500).send({
      error: { message: e.message || "An unknown error occurred." },
    });
  }
}
