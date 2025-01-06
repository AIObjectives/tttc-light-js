import "dotenv/config";
import { Request, Response } from "express";
import { fetchSpreadsheetData } from "../googlesheet";
import { getStorageUrl, storeJSON } from "../storage";
import * as api from "tttc-common/api";
import * as schema from "tttc-common/schema";
import { formatData, uniqueSlug } from "../utils";
import { pipelineQueue } from "../Queue";
import * as firebase from "../Firebase";
import { DecodedIdToken } from "firebase-admin/lib/auth/token-verifier";

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
  const { env } = req.context;
  const { CLIENT_BASE_URL, OPENAI_API_KEY, OPENAI_API_KEY_PASSWORD } = env;
  const body = api.generateApiRequest.parse(req.body);
  console.log("body", body);
  const { data, userConfig, firebaseAuthToken } = body;
  if (!firebaseAuthToken) throw new Error("TESTING: no firebaseAuthToken");
  if (firebaseAuthToken === "firebaseAuthToken") throw new Error("success");
  const parsedData = await parseData(data);
  const filename = uniqueSlug(userConfig.title);
  const jsonUrl = getStorageUrl(filename);
  await storeJSON(
    filename,
    JSON.stringify({ message: "Your data is being generated" }),
  );
  const decodedUser: DecodedIdToken | null = firebaseAuthToken
    ? await firebase.verifyUser(firebaseAuthToken)
    : null;
  // add job to firebase for easy reference
  const maybeFirebaseJobId = decodedUser
    ? await firebase.addReportJob({
        userId: decodedUser.uid,
        title: userConfig.title,
        description: userConfig.description,
        reportDataUri: jsonUrl,
      })
    : null;

  const reportUrl = new URL(
    `report/${encodeURIComponent(jsonUrl)}`,
    CLIENT_BASE_URL,
  ).toString();

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

  const response: api.GenerateApiResponse = {
    message: "Request received.",
    filename: filename,
    jsonUrl,
    reportUrl,
  };
  res.send(response);

  // add id to comment data if not included.
  const updatedConfig = {
    ...config,
    data: config.data.map((data, i) => ({
      ...data,
      id: data.id ? data.id : `cm${i}`,
    })),
  };

  // either track this from its job/reportId or its filename
  const jobId = decodedUser ? maybeFirebaseJobId : config.filename;

  const _ = await pipelineQueue.add(
    "pipeline",
    {
      config: updatedConfig,
      env,
      firebaseDetails: decodedUser
        ? { userId: decodedUser.uid, reportDataUri: jsonUrl }
        : null,
    },
    { jobId },
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
