import "dotenv/config";
import { Request, Response } from "express";
import { fetchSpreadsheetData } from "../googlesheet";
import { createStorage } from "../storage";
import * as api from "tttc-common/api";
import * as schema from "tttc-common/schema";
import { formatData, uniqueSlug } from "../utils";
import { pipelineQueue } from "../server";
import * as firebase from "../Firebase";
import { DecodedIdToken } from "firebase-admin/auth";

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

/* Randomize array using Durstenfeld shuffle algorithm */
function shuffleArray<T>(array: T[]): T[] {
  let arr = array.slice(0); // copy array so it doesn't happen in place
  for (var i = arr.length - 1; i >= 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

const useAnonymousNames = (numOfEmptyInterviewRows: number) => {
  const anonNames = Array.from(Array(numOfEmptyInterviewRows).keys()).map(
    (num) => `Anonymous #${num + 1}`,
  );

  const shuffled = shuffleArray(anonNames);

  let i = 0;

  return () => {
    if (i > shuffled.length - 1) {
      throw new Error("Ran out of anonymous names");
    } else {
      const name = shuffled[i];
      i++;
      return name;
    }
  };
};

async function createNewReport(req: Request, res: Response) {
  const { env } = req.context;
  const { CLIENT_BASE_URL, OPENAI_API_KEY, OPENAI_API_KEY_PASSWORD } = env;
  const body = api.generateApiRequest.parse(req.body);
  // ! Brandon: This config object should be phased out
  const { data, userConfig, firebaseAuthToken } = body;

  const storage = createStorage(env, "public");

  // ! Temporary size check
  // TODO: configure devprod filesize flag
  const datastr = JSON.stringify(data);
  if (datastr.length > 150 * 1024) {
    throw new Error("Data too big - limit of 150kb for alpha");
  }
  const _parsedData = await parseData(data);
  const makeAnonName = useAnonymousNames(
    //NOTE: this check used to be for x.interview === undefined
    _parsedData.data.filter((x) => !x.interview).length,
  );
  // Add anonymous names if interview prop is undefined
  const parsedData: {
    data: schema.SourceRow[];
    pieChart?: schema.LLMPieChart[];
  } = {
    ..._parsedData,
    data: _parsedData.data.map((sr) => ({
      ...sr,
      interview: sr.interview ?? makeAnonName(),
    })),
  };

  const filename = uniqueSlug(userConfig.title);

  const saveResult = await storage.save(
    filename,
    JSON.stringify({ message: "Your data is being generated" }),
  );
  if (saveResult.tag === "failure") {
    throw saveResult.error;
  }
  const jsonUrl = saveResult.value;
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
        status: "pending",
        createdAt: new Date(),
      })
    : null;

  const reportUrl = new URL(
    `report/${encodeURIComponent(jsonUrl)}`,
    CLIENT_BASE_URL,
  ).toString();

  // if user provided key is the same as our password, let them use our key
  // const apiKey =
  //   userConfig.apiKey === OPENAI_API_KEY_PASSWORD
  //     ? OPENAI_API_KEY
  //     : userConfig.apiKey;
  const apiKey = OPENAI_API_KEY;
  // ! Brandon: This config object should be phased out
  // ! FIX
  // @ts-ignore
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
  // ! Brandon: This config object should be phased out
  const updatedConfig = {
    ...config,
    data: config.data.map((data, i) => ({
      ...data,
      id: data.id ? data.id : `cm${i}`,
    })),
  };

  const _ = await pipelineQueue.add(
    "pipeline",
    {
      config: updatedConfig,
      env,
      firebaseDetails: decodedUser
        ? {
            userId: decodedUser.uid,
            reportDataUri: jsonUrl,
            firebaseJobId: maybeFirebaseJobId,
          }
        : null,
    },
    { jobId: config.filename },
  );
}

export default async function create(req: Request, res: Response) {
  try {
    return createNewReport(req, res);
  } catch (e) {
    console.error(e);

    res.status(500).send({
      error: {
        message: e instanceof Error ? e.message : "An unknown error occurred.",
      },
    });
  }
}
