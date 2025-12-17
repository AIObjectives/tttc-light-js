import "dotenv/config";
import { Response } from "express";
import { RequestWithLogger, getRequestId } from "../types/request";
import { fetchSpreadsheetData } from "../googlesheet";
import { createStorage } from "../storage";
import * as api from "tttc-common/api";
import * as schema from "tttc-common/schema";
import { pipelineQueue } from "../server";
import * as firebase from "../Firebase";
import { DecodedIdToken } from "firebase-admin/auth";
import { PipelineJob } from "src/jobs/pipeline";
import { Env } from "../types/context";
import { sendErrorByCode } from "./sendError";
import { ERROR_CODES, ERROR_MESSAGES, ErrorCode } from "tttc-common/errors";
import { Result } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import { getUserCapabilities, DEFAULT_LIMITS } from "tttc-common/permissions";
const REPORT_PLACEHOLDER_MESSAGE = "Your data is being generated";

const createLogger = logger.child({ module: "create" });

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

class EmailNotVerifiedError extends Error {
  constructor() {
    super(ERROR_MESSAGES[ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED]);
    this.name = "EmailNotVerifiedError";
  }
}

/**
 * Process Google Sheets data for report creation.
 *
 * @param googleData - Google Sheets configuration including URL and options
 * @returns Formatted source rows and optional pie chart data
 *
 * @remarks
 * Data Flow:
 * 1. fetchSpreadsheetData() fetches and parses Google Sheets via API
 * 2. Data is transformed into SourceRow[] format during parsing
 * 3. Returns pre-formatted data ready for security validation
 *
 * Note: formatData() is NOT called here because fetchSpreadsheetData()
 * already formats data into SourceRow[] during the parsing phase.
 */
const handleGoogleSheets = async (
  googleData: schema.GoogleSheetData,
): Promise<{ data: schema.SourceRow[]; pieCharts: schema.LLMPieChart[] }> => {
  const { data, pieCharts } = await fetchSpreadsheetData(
    googleData.url,
    googleData.pieChartColumns,
    googleData.filterEmails,
    googleData.oneSubmissionPerEmail,
  );

  // fetchSpreadsheetData already returns properly formatted SourceRow[]
  return {
    data,
    pieCharts,
  };
};

/**
 * Process and validate CSV data from client.
 *
 * @param csvData - Pre-formatted SourceRow[] from client-side CSV parser
 * @returns Validated and sanitized source rows
 * @throws {CreateReportError} If security validation fails or injection is detected
 *
 * @remarks
 * Data Flow:
 * 1. Client parses CSV file using Papa Parse library
 * 2. Client calls formatData() from tttc-common/utils to convert to SourceRow[]
 * 3. Formatted data is sent to this endpoint
 * 4. Server validates and sanitizes (this function)
 * 5. Data proceeds to report generation pipeline
 *
 * Security Layers:
 * - validateParsedData(): Structural validation and injection detection
 * - detectCSVInjection(): Field-level formula injection detection
 *
 * Note: formatData() is NOT called here because CSV data arrives
 * pre-formatted from the client. This function only validates and
 * sanitizes the already-formatted data.
 */
const handleCsvData = async (
  csvData: schema.SourceRow[],
): Promise<{ data: schema.SourceRow[] }> => {
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

  // CSV data is already in SourceRow format from the client
  return {
    data: csvData,
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

const validateFileSize = (
  actualDataSize: number | undefined,
  maxFileSize: number,
  isCsv: boolean,
) => {
  // Only validate file size for CSV uploads
  if (isCsv && typeof actualDataSize === "number") {
    if (actualDataSize > maxFileSize) {
      throw new Error(
        `File is too large - ${Math.round(maxFileSize / 1024)}KB limit`,
      );
    }
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
  reportId: string,
) => {
  // Use stable filename based on reportId for regeneration consistency
  const filename = `${reportId}.json`;
  createLogger.info(
    { filename, reportId },
    "Using stable filename for storage based on reportId",
  );

  const saveResult = await storage.save(
    filename,
    JSON.stringify({ message: REPORT_PLACEHOLDER_MESSAGE }),
  );

  if (saveResult.tag === "failure") {
    throw saveResult.error;
  }

  createLogger.info({ url: saveResult.value }, "Storage saved with URL");

  return { filename, jsonUrl: saveResult.value };
};

const handleUserAuthenticationAndCreateDocuments = async (
  firebaseAuthToken: string | null,
  userConfig: schema.LLMUserConfig,
  jsonUrl: string,
  preGeneratedReportId: string,
) => {
  const decodedUser: DecodedIdToken | null = firebaseAuthToken
    ? await firebase.verifyUser(firebaseAuthToken)
    : null;

  createLogger.info(
    { decodedUser: decodedUser || undefined },
    "Authentication result",
  );

  if (decodedUser) {
    // Check if user signed up with email/password and hasn't verified their email
    // Note: firebase.sign_in_provider is only present in real Firebase tokens
    const isEmailPasswordUser =
      decodedUser.firebase?.sign_in_provider === "password";
    const isEmailVerified = decodedUser.email_verified === true;

    if (isEmailPasswordUser && !isEmailVerified) {
      createLogger.warn(
        {
          uid: decodedUser.uid,
          email: decodedUser.email,
          provider: decodedUser.firebase?.sign_in_provider,
          emailVerified: isEmailVerified,
        },
        "Email verification required for email/password users",
      );
      throw new EmailNotVerifiedError();
    }

    createLogger.info({ uid: decodedUser.uid }, "Calling ensureUserDocument");
    await firebase.ensureUserDocument(
      decodedUser.uid,
      decodedUser.email || null,
      decodedUser.name || null,
    );
    createLogger.info({ uid: decodedUser.uid }, "ensureUserDocument completed");

    // Atomically create both ReportJob and ReportRef documents with actual URL
    const { jobId, reportId } = await firebase.createReportJobAndRef(
      {
        userId: decodedUser.uid,
        title: userConfig.title,
        description: userConfig.description,
        reportDataUri: jsonUrl, // Use actual URL from storage
        createdAt: new Date(),
      },
      {
        userId: decodedUser.uid,
        reportDataUri: jsonUrl, // Use actual URL from storage
        title: userConfig.title,
        description: userConfig.description,
        numTopics: 0, // Placeholder, will be updated
        numSubtopics: 0, // Placeholder, will be updated
        numClaims: 0, // Placeholder, will be updated
        numPeople: 0, // Placeholder, will be updated
        createdDate: new Date(),
      },
      preGeneratedReportId, // Use the same reportId as storage filename
    );

    createLogger.info(
      { jobId, reportId, uid: decodedUser.uid },
      "Atomically created ReportJob and ReportRef documents",
    );

    return { decodedUser, firebaseJobId: jobId, reportId };
  } else {
    createLogger.info("No decodedUser, skipping document creation");
    return { decodedUser: null, firebaseJobId: null, reportId: null };
  }
};

const buildPipelineJob = (
  env: Env,
  decodedUser: DecodedIdToken,
  firebaseJobId: string,
  reportId: string,
  userConfig: schema.LLMUserConfig,
  updatedConfig: schema.LLMUserConfig & { data: schema.SourceRow[] },
  jsonUrl: string,
): PipelineJob => {
  const filename = `${reportId}.json`;

  return {
    config: {
      firebaseDetails: {
        userId: decodedUser.uid,
        reportDataUri: jsonUrl,
        firebaseJobId,
        reportId,
      },
      env,
      auth: "public",
      instructions: {
        ...userConfig,
        cruxInstructions: userConfig.cruxInstructions,
      },
      api_key: "", // ! Change when we transition away from using the AOI key,
      options: {
        cruxes: updatedConfig.cruxesEnabled ?? false,
        bridging: updatedConfig.bridgingEnabled ?? false,
      },
      llm: {
        model: "gpt-4o-mini", // ! Change when we allow different models
      },
    },
    data: updatedConfig.data,
    reportDetails: {
      title: updatedConfig.title,
      description: updatedConfig.description,
      question: updatedConfig.title, // Using title as question fallback
      filename: filename, // Use validated filename based on reportId
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

/**
 * Calculate the size of parsed data in bytes
 * @param data Array of parsed row objects
 * @returns Size in bytes or undefined if no data
 */
const calculateDataSize = (data: schema.SourceRow[]): number | undefined => {
  if (!data || data.length === 0) {
    return undefined;
  }

  // Calculate the size of the JSON representation of the data
  // This is what's actually being transmitted and processed
  const jsonString = JSON.stringify(data);

  return Buffer.byteLength(jsonString, "utf8");
};

const getUserCsvSizeLimit = async (
  firebaseAuthToken: string | null,
): Promise<number> => {
  let userCsvSizeLimit = DEFAULT_LIMITS.csvSizeLimit;

  if (firebaseAuthToken) {
    try {
      const decodedToken = await firebase.verifyUser(firebaseAuthToken);
      if (decodedToken) {
        const userRef = firebase.db
          .collection(firebase.getCollectionName("USERS"))
          .doc(decodedToken.uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          const roles = userData?.roles || [];
          const capabilities = getUserCapabilities(roles);
          userCsvSizeLimit = capabilities.csvSizeLimit;
          createLogger.info(
            {
              uid: decodedToken.uid,
              roles,
              capabilities,
            },
            "User CSV size limit determined from roles",
          );
        }
      }
    } catch (error) {
      createLogger.warn(
        { error },
        "Failed to get user roles, using default limit",
      );
    }
  }

  return userCsvSizeLimit;
};

async function createNewReport(
  req: RequestWithLogger,
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

  // Get user's CSV size limit based on roles and feature flags
  const userCsvSizeLimit = await getUserCsvSizeLimit(firebaseAuthToken);

  // Validate file size for CSV uploads
  const isCsv = data[0] === "csv";

  // Calculate actual size of received data (server-side validation)
  let actualDataSize: number | undefined;
  if (isCsv && data[1]) {
    const csvRows = data[1] as schema.SourceRow[];
    actualDataSize = calculateDataSize(csvRows);

    if (actualDataSize !== undefined) {
      req.log.debug(
        { actualDataSize, sourceType: data[0] },
        "Data size calculated for validation",
      );
    }
  }

  // Validate actual data size against user's limit
  validateFileSize(actualDataSize, userCsvSizeLimit, isCsv);

  // Parse and process data
  const _parsedData = await parseData(data);
  const parsedData = addAnonymousNames(_parsedData);

  // Generate reportId that will be used for both storage filename and Firebase document ID
  const reportId = firebase.db
    .collection(firebase.getCollectionName("REPORT_REF"))
    .doc().id;

  // Create storage file with stable filename
  const storage = createStorage(env);
  const { filename, jsonUrl } = await createAndSaveReport(storage, reportId);

  // Now handle authentication and create Firebase documents with actual URL
  const {
    decodedUser,
    firebaseJobId,
    reportId: createdReportId,
  } = await handleUserAuthenticationAndCreateDocuments(
    firebaseAuthToken,
    userConfig,
    jsonUrl,
    reportId,
  );

  // Validate required Firebase data
  if (decodedUser === null)
    throw new Error("Firebase is now required to run a report.");
  if (firebaseJobId === null) throw new Error("Failed to add firebase job.");
  if (createdReportId === null)
    throw new Error("Failed to create report reference.");

  const reportUrl = new URL(`report/${reportId}`, CLIENT_BASE_URL).toString();

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
    cruxesEnabled: userConfig.cruxesEnabled ?? false,
    bridgingEnabled: userConfig.bridgingEnabled ?? false,
    data: config.data.map((data, i) => ({
      ...data,
      id: data.id ? data.id : `cm${i}`,
    })),
  } as typeof config & { cruxesEnabled: boolean; bridgingEnabled: boolean };

  createLogger.debug(
    {
      cruxesEnabled: updatedConfig.cruxesEnabled,
      bridgingEnabled: updatedConfig.bridgingEnabled,
    },
    "Building pipeline job with config",
  );

  const pipelineJob = buildPipelineJob(
    env,
    decodedUser,
    firebaseJobId,
    reportId,
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

/**
 * Map error types to their corresponding error codes.
 */
function getErrorCodeForException(e: unknown): ErrorCode {
  const errorName = e instanceof Error ? e.name : "Unknown";
  switch (errorName) {
    case "EmailNotVerifiedError":
      return ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED;
    case "CreateReportError":
      // CSV security violations are client errors, not server errors
      return ERROR_CODES.CSV_SECURITY_VIOLATION;
    default:
      return ERROR_CODES.INTERNAL_ERROR;
  }
}

export default async function create(req: RequestWithLogger, res: Response) {
  const requestId = getRequestId(req);

  try {
    const result = await createNewReport(req);
    if (result.tag === "failure") {
      sendErrorByCode(
        res,
        ERROR_CODES.VALIDATION_ERROR,
        createLogger,
        requestId,
      );
      return;
    }
    res.json(result.value.response);

    // Queue the pipeline job in the background
    // Use firebaseJobId as queue job ID but stable reportId-based filename for storage
    // This ensures consistent storage location for regeneration scenarios
    try {
      await pipelineQueue.enqueue(result.value.pipelineJob);
    } catch (queueError) {
      // Log queue error but don't fail the request since response is already sent
      req.log.error(
        {
          error: queueError,
          errorMessage:
            queueError instanceof Error
              ? queueError.message
              : "Queue error occurred",
        },
        "Failed to enqueue pipeline job",
      );
    }
  } catch (e) {
    req.log.error(
      {
        error: e,
        errorMessage:
          e instanceof Error ? e.message : "An unknown error occurred",
      },
      "Create report error",
    );
    sendErrorByCode(res, getErrorCodeForException(e), createLogger, requestId);
  }
}
