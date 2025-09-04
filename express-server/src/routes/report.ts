import { Response } from "express";
import { Logger } from "pino";
import { RequestWithLogger, RequestWithAuth } from "../types/request";
import * as api from "tttc-common/api";
import * as utils from "tttc-common/utils";
import { pipelineQueue } from "../server";
import { Bucket } from "../storage";
import { sendError } from "./sendError";
import { Result } from "tttc-common/functional-utils";
import {
  findReportRefByUri,
  getReportRefById,
  getReportVersion,
} from "../Firebase";
import { logger } from "tttc-common/logger";
import { FIRESTORE_ID_REGEX } from "tttc-common/utils";
import { ReportRef } from "tttc-common/firebase";
import { DecodedIdToken } from "firebase-admin/auth";

// Simple validation helpers
function isValidFirebaseId(id: string): boolean {
  return FIRESTORE_ID_REGEX.test(id);
}

const reportLogger = logger.child({ module: "report" });

/**
 * Adds simple deprecation signaling to legacy endpoints
 */
function addDeprecationSignaling(res: Response, endpoint: string) {
  res.set("Deprecation", "true");
  reportLogger.warn({ endpoint }, "Legacy endpoint accessed");
}

class BucketParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BucketParseError";
  }
}

/**
 * Simple GCS URI parser
 */
function parseGcsUri(uri: string): { bucket: string; fileName: string } | null {
  const match = uri.match(/https:\/\/storage\.googleapis\.com\/([^\/]+)\/(.+)/);
  if (!match) return null;
  return { bucket: match[1], fileName: match[2] };
}

/**
 * Gets job lookup ID for status checking
 */
function getJobLookupId(reportRef: ReportRef, reportId: string): string {
  if (getReportVersion(reportRef) === "legacy") {
    const filename = reportRef.reportDataUri
      .split("/")
      .pop()
      ?.replace(".json", "");
    if (!filename) {
      throw new Error("Invalid report data URI");
    }
    return filename;
  } else {
    return reportRef.jobId || reportId;
  }
}

/**
 * Resolves job status with simplified error handling
 */
async function getResolvedJobStatus(
  jobLookupId: string,
): Promise<api.ReportJobStatus> {
  const jobState = await pipelineQueue.getJobState(jobLookupId);

  // Simple status mapping
  switch (jobState) {
    case "unknown":
      return api.reportJobStatus.Values["notFound"];
    case "completed":
      return api.reportJobStatus.Values.finished;
    case "failed":
      return api.reportJobStatus.Values.failed;
    case "waiting":
      return api.reportJobStatus.Values.queued;
    default:
      // For "active" or other states, get from job progress
      try {
        const job = await pipelineQueue.getJob(jobLookupId);
        const progress = await job.progress;
        return progress.status || api.reportJobStatus.Values.clustering;
      } catch {
        return api.reportJobStatus.Values.clustering; // Default fallback
      }
  }
}

function getBucketAndFileName(
  req: RequestWithLogger,
): Result<{ bucket: string; fileName: string }, BucketParseError> {
  const rawUri = req.params.reportUri;
  if (!rawUri || typeof rawUri !== "string" || rawUri.length > 1000) {
    return {
      tag: "failure",
      error: new BucketParseError("Invalid URI parameter"),
    };
  }

  let uri: string;
  try {
    uri = decodeURIComponent(api.getReportRequestUri.parse(rawUri));
  } catch (error) {
    return {
      tag: "failure",
      error: new BucketParseError("Failed to decode URI parameter"),
    };
  }

  // Convert legacy URI to GCS format if needed
  const gcsUri = uri.startsWith("https://storage.googleapis.com/")
    ? uri
    : `https://storage.googleapis.com/${uri}`;

  const parsed = parseGcsUri(gcsUri);
  if (!parsed) {
    reportLogger.warn("Invalid report URI received");
    return {
      tag: "failure",
      error: new BucketParseError("Invalid or missing report URI"),
    };
  }

  return {
    tag: "success",
    value: parsed,
  };
}

export async function getReportStatusHandler(
  req: RequestWithLogger,
  res: Response,
) {
  // Add deprecation signaling for legacy endpoint
  addDeprecationSignaling(res, "/report/:reportUri/status");

  const parsed = getBucketAndFileName(req);
  switch (parsed.tag) {
    case "success": {
      const { fileName } = parsed.value;

      const jobState = await pipelineQueue.getJobState(fileName);

      const status = await getResolvedJobStatus(fileName);
      return res.json({ status });
    }
    case "failure":
      req.log.error(
        { reportUri: req.params.reportUri, error: parsed.error },
        "Invalid or missing report URI",
      );
      sendError(res, 404, "Invalid or missing report URI", "InvalidReportUri");
      return;
    default:
      utils.assertNever(parsed);
  }
}

export async function getReportDataHandler(
  req: RequestWithLogger,
  res: Response,
) {
  // Add deprecation signaling for legacy endpoint
  addDeprecationSignaling(res, "/report/:reportUri/data");

  const env = req.context.env;
  const parsed = getBucketAndFileName(req);
  switch (parsed.tag) {
    case "success": {
      const { bucket, fileName } = parsed.value;

      try {
        const storage = new Bucket(env.GOOGLE_CREDENTIALS_ENCODED, bucket);
        const urlResult = await storage.getUrl(fileName);
        if (urlResult.tag === "failure") {
          req.log.error({ error: urlResult.error }, "Failed to get signed URL");
          return sendError(
            res,
            500,
            "Failed to generate report URL",
            "GetUrlError",
          );
        } else {
          res.json({ url: urlResult.value });
        }
      } catch (e) {
        reportLogger.error({ error: e }, "Error generating URL");
        sendError(res, 500, "Failed to generate report URL", "GetUrlError");
      }
      break;
    }
    case "failure":
      sendError(res, 404, "Invalid or missing report URI", "InvalidReportUri");
      return;
    default:
      utils.assertNever(parsed);
  }
}

export async function migrateReportUrlHandler(
  req: RequestWithLogger,
  res: Response,
) {
  // Add deprecation signaling - this migration endpoint is temporary
  addDeprecationSignaling(res, "/report/migrate/:reportUri");

  const parsed = getBucketAndFileName(req);
  if (parsed.tag === "failure") {
    reportLogger.warn(
      { errorType: parsed.error.name },
      "Migration attempt with invalid URI",
    );
    return sendError(res, 400, "Invalid report URI", "InvalidReportUri");
  }

  const { bucket, fileName } = parsed.value;
  const reportDataUri = `https://storage.googleapis.com/${bucket}/${fileName}`;

  try {
    // Search Firebase for ReportRef with matching reportDataUri
    const reportRef = await findReportRefByUri(reportDataUri);

    if (reportRef) {
      reportLogger.info({ reportId: reportRef.id }, "URL migration successful");

      const response: api.MigrationApiResponse = {
        success: true,
        newUrl: `/report/id/${reportRef.id}`,
        docId: reportRef.id,
      };

      // Set cache headers for successful migrations
      res.set("Cache-Control", "private, max-age=3600");
      return res.json(response);
    } else {
      // Null return means document not found (expected case)
      reportLogger.info("No document found for legacy URL");

      const response: api.MigrationApiResponse = {
        success: false,
        message: "No document found for this legacy URL",
      };

      res.set("Cache-Control", "private, max-age=1800"); // Shorter cache for not found
      return res.json(response);
    }
  } catch (error) {
    // Exception means Firebase system error (unexpected)
    reportLogger.error({ error }, "Firebase system error during URL migration");
    sendError(
      res,
      500,
      "Migration service temporarily unavailable",
      "MigrationError",
    );
    return;
  }
}

export async function getReportByIdStatusHandler(
  req: RequestWithLogger & { auth?: DecodedIdToken },
  res: Response,
) {
  const reportId = req.params.reportId;

  // Basic validation
  if (!isValidFirebaseId(reportId)) {
    return sendError(res, 404, "Report not found", "ReportNotFound");
  }

  try {
    const reportRef = await getReportRefById(reportId);
    if (!reportRef) {
      return sendError(res, 404, "Report not found", "ReportNotFound");
    }

    // Get job lookup ID and status
    const jobLookupId = getJobLookupId(reportRef, reportId);
    const status = await getResolvedJobStatus(jobLookupId);

    reportLogger.debug(
      { reportId, jobLookupId, status },
      "Report status resolved",
    );
    return res.json({ status });
  } catch (error) {
    reportLogger.error({ error }, "Error getting report status");
    return sendError(
      res,
      500,
      "Report service temporarily unavailable",
      "ReportServiceError",
    );
  }
}

export async function getReportByIdDataHandler(
  req: RequestWithLogger & { auth?: DecodedIdToken },
  res: Response,
) {
  const reportId = req.params.reportId;
  const env = req.context.env;

  // Basic validation
  if (!isValidFirebaseId(reportId)) {
    return sendError(res, 404, "Report not found", "ReportNotFound");
  }

  try {
    const reportRef = await getReportRefById(reportId);
    if (!reportRef) {
      return sendError(res, 404, "Report not found", "ReportNotFound");
    }

    // Check if report data is available
    if (!reportRef.reportDataUri || reportRef.reportDataUri.trim() === "") {
      return sendError(
        res,
        404,
        "Report data not yet available",
        "ReportNotReady",
      );
    }

    // Parse storage location
    const parsed = parseGcsUri(reportRef.reportDataUri);
    if (!parsed) {
      return sendError(res, 500, "Invalid report data URI", "InvalidDataUri");
    }

    // Get signed URL using existing Bucket class
    const storage = new Bucket(env.GOOGLE_CREDENTIALS_ENCODED, parsed.bucket);
    const urlResult = await storage.getUrl(parsed.fileName);

    if (urlResult.tag === "failure") {
      reportLogger.error(
        { error: urlResult.error },
        "Failed to get signed URL",
      );
      return sendError(
        res,
        500,
        "Failed to generate report URL",
        "GetUrlError",
      );
    }

    res.set("Cache-Control", "private, max-age=60");
    res.json({ url: urlResult.value });
  } catch (error) {
    reportLogger.error({ error }, "Error getting report data");
    return sendError(
      res,
      500,
      "Report service temporarily unavailable",
      "ReportServiceError",
    );
  }
}

export async function getReportByIdMetadataHandler(
  req: RequestWithLogger & { auth?: DecodedIdToken },
  res: Response,
) {
  const reportId = req.params.reportId;

  // Basic validation
  if (!isValidFirebaseId(reportId)) {
    return sendError(res, 404, "Report not found", "ReportNotFound");
  }

  try {
    const reportRef = await getReportRefById(reportId);
    if (!reportRef) {
      return sendError(res, 404, "Report not found", "ReportNotFound");
    }

    // Add cache headers for metadata
    res.set("Cache-Control", "private, max-age=300"); // 5 minutes
    res.json(reportRef);
  } catch (error) {
    reportLogger.error({ error, reportId }, "Error getting report metadata");
    return sendError(
      res,
      500,
      "Failed to fetch report metadata",
      "MetadataError",
    );
  }
}
