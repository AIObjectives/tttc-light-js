import "dotenv/config";
import { Request, Response } from "express";
import pipeline from "../pipeline";
import { OldOptions } from "tttc-common/schema";
import { getStorageUrl, storeJSON } from "../storage";
import { uniqueSlug, formatData } from "../utils";
import { fetchSpreadsheetData } from "../googlesheet";
import { GenerateApiResponse, GenerateApiRequest } from "tttc-common/api";

/**
 * @deprecated
 */
export default async function generate(req: Request, res: Response) {
  console.log("inside generate");
  let responded = false;
  try {
    const body: GenerateApiRequest = req.body;
    const { data: dataPayload, userConfig } = body;
    // @ts-ignore
    const config: OldOptions = userConfig;
    // @ts-ignore
    if (dataPayload[0] === "googlesheet") {
      // @ts-ignore
      const googleSheet = dataPayload[1];
      const { data, pieCharts } = await fetchSpreadsheetData(
        // @ts-ignore
        googleSheet.url,
        // @ts-ignore
        googleSheet.pieChartColumns,
        // @ts-ignore
        googleSheet.filterEmails,
        // @ts-ignore
        googleSheet.oneSubmissionPerEmail,
      );
      config.data = formatData(data);
      config.pieCharts = pieCharts;
    }
    // if (!config.data) {
    //   throw new Error("Missing data");
    // }
    // @ts-ignore
    config.data = formatData(dataPayload[1]);
    // allow users to use our keys if they provided the password
    if (config.apiKey === process.env.OPENAI_API_KEY_PASSWORD) {
      config.apiKey = process.env.OPENAI_API_KEY!;
    } else if (config.apiKey === process.env.ANTHROPIC_API_KEY_PASSWORD) {
      config.apiKey = process.env.ANTHROPIC_API_KEY!;
    }
    if (!config.apiKey) {
      throw new Error("Missing API key");
    }
    const clientBaseUrl = process.env.CLIENT_BASE_URL;
    if (!clientBaseUrl)
      throw new Error("You need a CLIENT_BASE_URL defined in env");
    // @ts-ignore
    config.filename = config.filename || uniqueSlug(config.title);
    const jsonUrl = getStorageUrl(config.filename);
    await storeJSON(
      config.filename,
      JSON.stringify({ message: "Your data is being generated" }),
    );
    const reportUrl = new URL(
      `report/${encodeURIComponent(jsonUrl)}`,
      clientBaseUrl,
    ).toString();
    const response: GenerateApiResponse = {
      message: "Request received.",
      filename: config.filename,
      jsonUrl,
      reportUrl,
    };
    res.send(response);
    responded = true;
    console.log(10);
    const json = await pipeline(config);
    console.log(11);
    await storeJSON(config.filename, JSON.stringify(json), true);
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
