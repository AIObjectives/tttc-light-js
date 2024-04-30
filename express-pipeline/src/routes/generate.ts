import { Request, Response } from "express";
import pipeline from "../pipeline";
import { DataPayload, Options, PieChart, SourceRow } from "tttc-common/schema";
import { uniqueSlug, formatData } from "../utils";
import { fetchSpreadsheetData } from "../googlesheet";
import { GenerateApiResponse, GenerateApiRequest } from "tttc-common/api";
import { Storage } from "@google-cloud/storage";

/**
 * Gets the data that will go into the JSON file
 * Return SourceRows and PieCharts
 */
const getData = async (
  dataPayload: DataPayload,
): Promise<{ data: SourceRow[]; pieCharts: PieChart[] }> =>
  dataPayload[0] === "googlesheet"
    ? formatData(await fetchSpreadsheetData(dataPayload[1]))
    : { data: dataPayload[1], pieCharts: [] };

/**
 * Compares provided key with key password env var to see if it should use the host's key.
 */
const getApiKey = (configKey: string): string => {
  if (configKey === process.env.OPENAI_API_KEY_PASSWORD) {
    return process.env.OPENAI_API_KEY!;
  } else if (configKey === process.env.ANTHROPIC_API_KEY_PASSWORD) {
    return process.env.ANTHROPIC_API_KEY!;
  } else {
    return configKey;
  }
};

// *** URLS ***

/**
 * HOC for urls
 */
const createUrl = (baseUrl: string) => (path: string) =>
  new URL(path, baseUrl).toString();

/**
 * Curried url function that returns the bucket url
 */
const baseBucketUrl = createUrl(
  `https://storage.googleapis.com/${process.env.GCLOUD_STORAGE_BUCKET}/`,
);

/**
 * Returns url for where JSON data is stored in the cloud.
 */
const jsonUrl = (filename: string) => baseBucketUrl(filename);

/**
 * Curried url function that returns client side urls
 */
const baseClientUrl = createUrl(process.env.CLIENT_BASE_URL);

/**
 * Returns wherever the user can view the report they generated
 */
const _reportUrl = (jsonUrl: string) =>
  baseClientUrl(`report/${encodeURIComponent(jsonUrl)}`);

const reportUrl = (filename: string) => _reportUrl(jsonUrl(filename));

// ** JSON functions **

/**
 * GCloud credentials
 */
const credentials = Buffer.from(
  process.env.GOOGLE_CREDENTIALS_ENCODED,
  "base64",
).toString("utf-8");

/**
 * Google Storage Object
 */
const storage = new Storage({ credentials: JSON.parse(credentials) });

/**
 * Google Storage Bucket
 */
const bucket = storage.bucket(process.env.GCLOUD_STORAGE_BUCKET);

/**
 * Takes a filename and then returns a function that can be used for storing JSON files
 */
const curryAddFile =
  (fileName: string) => async (fileContent: string, allowCache?: boolean) =>
    await bucket.file(fileName).save(fileContent, {
      metadata: {
        contentType: "application/json",
        ...(allowCache
          ? {}
          : {
              cacheControl: "no-cache, no-store, must-revalidate",
            }),
      },
    });

export async function generate(req: Request, res: Response) {
  let responded = false;
  try {
    const body: GenerateApiRequest = req.body;
    const { dataPayload, userConfig } = body;
    const config: Options = userConfig;

    const { data, pieCharts } = await getData(dataPayload);
    // allow users to use our keys if they provided the password
    const apiKey = getApiKey(config.apiKey);
    const filename = config.filename || uniqueSlug(config.title);

    const addFile = curryAddFile(filename);
    await addFile(JSON.stringify({ message: "Your data is being generated" }));

    const response: GenerateApiResponse = {
      message: "Request received.",
      filename,
      jsonUrl: jsonUrl(filename),
      reportUrl: reportUrl(filename),
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

    await addFile(JSON.stringify(json));
    console.log("produced file: " + jsonUrl(filename));
  } catch (err: any) {
    console.error(err);
    if (!responded) {
      res.status(500).send({
        error: { message: err.message || "An unknown error occurred." },
      });
    }
  }
}
