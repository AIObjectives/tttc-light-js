import { Request, Response } from "express";
import pipeline from "../pipeline";
import {
  DataPayload,
  Options,
  PieChart,
  SourceRow,
  dataPayload,
} from "tttc-common/schema";
import { getStorageUrl, storeJSON } from "../storage";
import { uniqueSlug, formatData } from "../utils";
import { fetchSpreadsheetData } from "../googlesheet";
import { GenerateApiResponse, GenerateApiRequest } from "tttc-common/api";

const getData = async (dataPayload: DataPayload) =>
  dataPayload[0] === "googlesheet"
    ? formatData(await fetchSpreadsheetData(dataPayload[1]))
    : { data: dataPayload[1], pieCharts: [] };

const getApiKey = (configKey: string): string => {
  if (configKey === process.env.OPENAI_API_KEY_PASSWORD) {
    return process.env.OPENAI_API_KEY!;
  } else if (configKey === process.env.ANTHROPIC_API_KEY_PASSWORD) {
    return process.env.ANTHROPIC_API_KEY!;
  } else {
    return configKey;
  }
};

export async function generate(req: Request, res: Response) {
  let responded = false;
  try {
    const body: GenerateApiRequest = req.body;
    const { dataPayload, userConfig } = body;
    const config: Options = userConfig;

    const { data, pieCharts } = await getData(dataPayload);
    // allow users to use our keys if they provided the password
    const apiKey = getApiKey(config.apiKey);
    const clientBaseUrl = process.env.CLIENT_BASE_URL;
    const filename = config.filename || uniqueSlug(config.title);
    const jsonUrl = getStorageUrl(filename);
    await storeJSON(
      filename,
      JSON.stringify({ message: "Your data is being generated" }),
    );
    const reportUrl = new URL(
      `report/${encodeURIComponent(jsonUrl)}`,
      clientBaseUrl,
    ).toString();
    const response: GenerateApiResponse = {
      message: "Request received.",
      filename,
      jsonUrl,
      reportUrl,
    };
    res.send(response);
    responded = true;
    const json = await pipeline({
      ...config,
      apiKey,
      data,
      pieCharts,
      filename,
    });
    await storeJSON(filename, JSON.stringify(json), true);
    console.log("produced file: " + jsonUrl);
  } catch (err: any) {
    console.error(err);
    if (!responded) {
      res.status(500).send({
        error: { message: err.message || "An unknown error occurred." },
      });
    }
  }
}
