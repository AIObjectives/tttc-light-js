import { Request, Response } from "express";
import pipeline from "../pipeline";
import {
  DataPayload,
  Options,
  PieChart,
  SourceRow,
  SystemConfig,
  UserConfig,
  options,
} from "tttc-common/schema";
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

// ** URLS **

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

// ** Config **

/**
 * Creates config file for pipeline
 */
const createConfig = async (
  dataPayload: DataPayload,
  userConfig: UserConfig,
  systemConfig: SystemConfig,
): Promise<Options> => {
  const { data, pieCharts } = await getData(dataPayload);
  return {
    ...systemConfig,
    ...userConfig,
    data,
    pieCharts,
    apiKey: getApiKey(userConfig.apiKey),
    filename: systemConfig.filename || uniqueSlug(userConfig.title),
  };
};

export async function generate(req: Request, res: Response) {
  let responded = false;
  try {
    const body: GenerateApiRequest = req.body;
    const { dataPayload, userConfig } = body;

    // take input from API and transform it to options that the pipeline can use
    const config: Options = await createConfig(dataPayload, userConfig, {
      filename: "",
      batchSize: 10,
      model: "gpt-4-turbo-preview",
    });

    const addFile = curryAddFile(config.filename);
    // Add placeholder file to bucket
    await addFile(JSON.stringify({ message: "Your data is being generated" }));

    // Send response to user
    const response: GenerateApiResponse = {
      message: "Request received.",
      filename: config.filename,
      jsonUrl: jsonUrl(config.filename),
      reportUrl: reportUrl(config.filename),
    };
    res.send(response);
    responded = true;

    // Generate JSON from pipeline
    const json = options.parse(await pipeline(config));

    // Add JSON file to bucket
    await addFile(JSON.stringify(json));

    // Log location of file
    console.log("produced file: " + jsonUrl(config.filename));
  } catch (err: any) {
    console.error(err);
    if (!responded) {
      res.status(500).send({
        error: { message: err.message || "An unknown error occurred." },
      });
    }
  }
}
