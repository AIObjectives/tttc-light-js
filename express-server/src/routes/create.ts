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
import { PipelineJob } from "src/jobs/pipeline";
import { sendError } from "./sendError";
import { Result } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import {
  detectCSVInjection,
  validateParsedData,
} from "tttc-common/csv-security";

class CreateReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateReportError";
  }
}

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

const handleCsvData = async (csvData: schema.SourceRow[]) => {
  // Comprehensive server-side security validation
  const validationResult = validateParsedData(csvData);
  if (validationResult.tag === "failure") {
    throw new CreateReportError(
      `CSV security validation failed: ${validationResult.error.tag} - ${validationResult.error.message}`,
    );
  }

  // Additional field-level injection detection
  for (const row of csvData) {
    if (typeof row.comment === "string" && detectCSVInjection(row.comment)) {
      throw new CreateReportError(
        `Security violation: Potential injection detected in comment field: ${row.comment.substring(0, 50)}...`,
      );
    }
    if (
      typeof row.interview === "string" &&
      detectCSVInjection(row.interview)
    ) {
      throw new CreateReportError(
        `Security violation: Potential injection detected in interview field: ${row.interview.substring(0, 50)}...`,
      );
    }
    if (typeof row.id === "string" && detectCSVInjection(row.id)) {
      throw new CreateReportError(
        `Security violation: Potential injection detected in id field: ${row.id.substring(0, 50)}...`,
      );
    }
  }

  return {
    data: formatData(csvData),
  };
};

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

const validateDataSize = (data: schema.DataPayload) => {
  const datastr = JSON.stringify(data);
  if (datastr.length > 150 * 1024) {
    throw new Error("Data too big - limit of 150kb for alpha");
  }
};

const addAnonymousNames = (parsedData: {
  data: schema.SourceRow[];
  pieChart?: schema.LLMPieChart[];
}) => {
  const makeAnonName = useAnonymousNames(
    parsedData.data.filter((x) => !x.interview).length,
  );

  return {
    ...parsedData,
    data: parsedData.data.map((sr) => ({
      ...sr,
      interview: sr.interview ? sr.interview : makeAnonName(),
    })),
  };
};

const createAndSaveReport = async (
  storage: ReturnType<typeof createStorage>,
  userConfig: schema.LLMUserConfig,
) => {
  const filename = uniqueSlug(userConfig.title);
  const saveResult = await storage.save(
    filename,
    JSON.stringify({ message: "Your data is being generated" }),
  );

  if (saveResult.tag === "failure") {
    throw saveResult.error;
  }

  return { filename, jsonUrl: saveResult.value };
};

const handleUserAuthentication = async (
  firebaseAuthToken: string | null,
  userConfig: schema.LLMUserConfig,
  jsonUrl: string,
) => {
  const decodedUser: DecodedIdToken | null = firebaseAuthToken
    ? await firebase.verifyUser(firebaseAuthToken)
    : null;

  logger.info(
    "EXPRESS CREATE: Authentication result",
    decodedUser
      ? {
          uid: decodedUser.uid,
          email: decodedUser.email,
          email_verified: decodedUser.email_verified,
        }
      : "No authentication token provided",
  );

  if (decodedUser) {
    logger.info("EXPRESS CREATE: Calling ensureUserDocument", decodedUser.uid);
    await firebase.ensureUserDocument(
      decodedUser.uid,
      decodedUser.email || null,
      decodedUser.name || null,
    );
    logger.info(
      "EXPRESS CREATE: ensureUserDocument completed",
      decodedUser.uid,
    );

    const firebaseJobId = await firebase.addReportJob({
      userId: decodedUser.uid,
      title: userConfig.title,
      description: userConfig.description,
      reportDataUri: jsonUrl,
      status: "pending",
      createdAt: new Date(),
    });

    return { decodedUser, firebaseJobId };
  } else {
    logger.info("EXPRESS CREATE: No decodedUser, skipping ensureUserDocument");
    return { decodedUser: null, firebaseJobId: null };
  }
};

const buildPipelineJob = (
  env: any,
  decodedUser: DecodedIdToken,
  firebaseJobId: string,
  userConfig: schema.LLMUserConfig,
  updatedConfig: any,
  jsonUrl: string,
): PipelineJob => {
  return {
    config: {
      firebaseDetails: {
        userId: decodedUser.uid,
        reportDataUri: jsonUrl,
        firebaseJobId,
      },
      env,
      auth: "public",
      instructions: {
        ...userConfig,
        cruxInstructions: userConfig.cruxInstructions,
      },
      api_key: "", // ! Change when we transition away from using the AOI key,
      options: {
        cruxes: updatedConfig.cruxesEnabled,
      },
      llm: {
        model: "gpt-4o-mini", // ! Change when we allow different models
      },
    },
    data: updatedConfig.data,
    reportDetails: {
      ...updatedConfig,
    },
  };
};

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

async function createNewReport(
  req: Request,
): Promise<
  Result<
    { response: api.GenerateApiResponse; pipelineJob: PipelineJob },
    CreateReportError
  >
> {
  const { env } = req.context;
  const { CLIENT_BASE_URL } = env;
  const body = api.generateApiRequest.parse(req.body);
  const { data, userConfig, firebaseAuthToken } = body;

  // Validate data size
  validateDataSize(data);

  // Parse and process data
  const _parsedData = await parseData(data);
  const parsedData = addAnonymousNames(_parsedData);

  // Create and save report
  const storage = createStorage(env);
  const { filename, jsonUrl } = await createAndSaveReport(storage, userConfig);

  // Handle user authentication and Firebase operations
  const { decodedUser, firebaseJobId } = await handleUserAuthentication(
    firebaseAuthToken,
    userConfig,
    jsonUrl,
  );

  // Validate required Firebase data
  if (decodedUser === null)
    throw new Error("Firebase is now required to run a report.");
  if (firebaseJobId === null) throw new Error("Failed to add firebase job.");

  const reportUrl = new URL(
    `report/${encodeURIComponent(jsonUrl)}`,
    CLIENT_BASE_URL,
  ).toString();

  // ! Brandon: This config object should be phased out
  // @ts-ignore
  const config: schema.OldOptions = {
    ...userConfig,
    ...parsedData,
    filename,
  };

  const response: api.GenerateApiResponse = {
    message: "Request received.",
    filename: filename,
    jsonUrl,
    reportUrl,
  };

  // add id to comment data if not included.
  const updatedConfig = {
    ...config,
    data: config.data.map((data, i) => ({
      ...data,
      id: data.id ? data.id : `cm${i}`,
    })),
  };

  const pipelineJob = buildPipelineJob(
    env,
    decodedUser,
    firebaseJobId,
    userConfig,
    updatedConfig,
    jsonUrl,
  );

  return {
    tag: "success",
    value: {
      response,
      pipelineJob,
    },
  };
}

export default async function create(req: Request, res: Response) {
  try {
    const result = await createNewReport(req);
    if (result.tag === "failure") {
      sendError(res, 400, result.error.message, "CreateReportError");
      return;
    }
    res.json(result.value.response);

    // Queue the pipeline job in the background
    pipelineQueue.add("generate-report", result.value.pipelineJob, {
      jobId: result.value.response.filename,
    });
  } catch (e) {
    console.error(e);
    res.status(500).send({
      error: {
        message: e instanceof Error ? e.message : "An unknown error occurred.",
      },
    });
  }
}
