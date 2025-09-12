import { Response } from "express";
import { RequestWithLogger } from "../types/request";
import * as api from "tttc-common/api";
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
import { getAnalytics } from "tttc-common/analytics";
import { createHash } from "crypto";

// Simple validation helpers
function isValidFirebaseId(id: string): boolean {
  return FIRESTORE_ID_REGEX.test(id);
}

const reportLogger = logger.child({ module: "report" });

/**
 * Checks if report data is ready for download
 */
function isReportDataReady(
  status: api.ReportJobStatus,
  reportDataUri?: string,
): boolean {
  return (
    status === "finished" &&
    reportDataUri !== undefined &&
    reportDataUri.trim() !== ""
  );
}

/**
 * Validates URI parameter from request
 */
function isValidUriParam(rawUri: unknown): rawUri is string {
  return (
    typeof rawUri === "string" && rawUri.length > 0 && rawUri.length <= 1000
  );
}

/**
 * Type guard to check if ReportRef has authoritative status fields
 */
function hasAuthoritativeStatus(
  reportRef: ReportRef,
): reportRef is ReportRef & {
  status: string;
  processingSubState?: string;
  lastStatusUpdate?: Date;
} {
  return typeof reportRef.status === "string";
}

/**
 * Creates a privacy-safe hash of an identifier for analytics
 */
function createIdentifierHash(identifier: string): string {
  return createHash("sha256").update(identifier).digest("hex").substring(0, 8);
}

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
 * Maps authoritative ReportRef status to API status values
 * @param authoritativeStatus The status from ReportRef document
 * @param processingSubState Optional sub-state for processing reports
 * @param reportId Report ID for logging
 * @returns API status or null if mapping failed
 */
function mapAuthoritativeStatusToApiStatus(
  authoritativeStatus: string,
  processingSubState: string | undefined,
  reportId: string,
): api.ReportJobStatus | null {
  switch (authoritativeStatus) {
    case "created":
    case "queued":
      return api.reportJobStatus.Values.queued;

    case "processing":
      // Use sub-state if available and valid, otherwise default to clustering
      if (
        processingSubState &&
        api.reportJobStatus.Values[
          processingSubState as keyof typeof api.reportJobStatus.Values
        ]
      ) {
        return api.reportJobStatus.Values[
          processingSubState as keyof typeof api.reportJobStatus.Values
        ];
      }
      return api.reportJobStatus.Values.clustering;

    case "completed":
      return api.reportJobStatus.Values.finished;

    case "failed":
      return api.reportJobStatus.Values.failed;

    case "cancelled":
      return api.reportJobStatus.Values.failed; // Treat cancelled as failed for API consistency

    default:
      reportLogger.warn(
        { reportId, authoritativeStatus },
        "Unknown authoritative status value",
      );
      return null;
  }
}

/**
 * Validates if file contains actual report data vs placeholder
 */
async function validateReportFileContent(
  storage: Bucket,
  fileName: string,
  reportId: string,
): Promise<boolean> {
  try {
    const fileContent = await storage.get(fileName);
    if (fileContent.tag === "success") {
      reportLogger.debug(
        { reportId, status: "finished" },
        "Legacy: Report marked as finished - file contains valid data",
      );
      return true;
    } else {
      reportLogger.debug(
        { reportId, error: fileContent.error },
        "Legacy: File exists but contains invalid data",
      );
      return false;
    }
  } catch (contentError) {
    reportLogger.debug(
      { reportId, error: contentError },
      "Legacy: Error reading file content",
    );
    return false;
  }
}

/**
 * Fallback to job status when file validation fails
 */
async function fallbackToJobStatus(
  reportRef: ReportRef,
  reportId: string,
  reason: string,
): Promise<api.ReportJobStatus> {
  const jobLookupId = getJobLookupId(reportRef, reportId);
  const status = await getResolvedJobStatus(jobLookupId);
  reportLogger.debug(
    { reportId, jobLookupId, status, reason },
    "Legacy: Fallback to job status",
  );
  return status;
}

/**
 * Legacy status determination logic - use for reports without authoritative status
 * This encapsulates the old brittle logic for backward compatibility
 */
async function getLegacyStatus(
  reportRef: ReportRef,
  reportId: string,
  req: RequestWithLogger,
): Promise<api.ReportJobStatus> {
  // No data URI means report is not complete
  if (!reportRef.reportDataUri || reportRef.reportDataUri.trim() === "") {
    return fallbackToJobStatus(reportRef, reportId, "No reportDataUri");
  }

  // Validate URI format
  if (!reportRef.reportDataUri.startsWith("https://storage.googleapis.com/")) {
    return fallbackToJobStatus(reportRef, reportId, "Invalid URI format");
  }

  // Parse URI
  const parsed = parseGcsUri(reportRef.reportDataUri);
  if (!parsed) {
    reportLogger.warn(
      { reportId, invalidUri: reportRef.reportDataUri },
      "Legacy: Could not parse GCS URI",
    );
    return fallbackToJobStatus(reportRef, reportId, "URI parse failed");
  }

  // Validate bucket is allowed
  const allowedBuckets = req.context.env.ALLOWED_GCS_BUCKETS;
  if (!allowedBuckets.includes(parsed.bucket)) {
    reportLogger.warn(
      {
        reportId,
        bucket: parsed.bucket,
        allowedBuckets: allowedBuckets.join(","),
      },
      "Legacy: Bucket not in allowed list",
    );
    return fallbackToJobStatus(
      reportRef,
      reportId,
      "Unauthorized bucket access",
    );
  }

  // Check file existence and content
  try {
    const storage = new Bucket(
      req.context.env.GOOGLE_CREDENTIALS_ENCODED,
      parsed.bucket,
    );
    const fileExists = await storage.fileExists(parsed.fileName);

    if (!fileExists) {
      reportLogger.warn(
        { reportId, fileName: parsed.fileName, bucket: parsed.bucket },
        "Legacy: Report has URI but file doesn't exist",
      );
      return fallbackToJobStatus(reportRef, reportId, "File does not exist");
    }

    // File exists - validate content
    const hasValidContent = await validateReportFileContent(
      storage,
      parsed.fileName,
      reportId,
    );
    if (hasValidContent) {
      return api.reportJobStatus.Values.finished;
    } else {
      return fallbackToJobStatus(
        reportRef,
        reportId,
        "File contains invalid data",
      );
    }
  } catch (error) {
    reportLogger.error(
      { reportId, error },
      "Legacy: Error checking file existence",
    );
    return fallbackToJobStatus(reportRef, reportId, "Storage error");
  }
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
  // Support both identifier and reportUri parameter names
  const rawUri = req.params.identifier || req.params.reportUri;
  if (!isValidUriParam(rawUri)) {
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

/**
 * Handles migration from legacy bucket-style URLs to Firebase ID-based URLs.
 * This endpoint is deprecated and will be removed in a future version.
 *
 * @param req - Express request with logger, expects reportUri parameter
 * @param res - Express response
 * @returns JSON response with migration result or error
 */
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
        newUrl: `/report/${reportRef.id}`,
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

/**
 * Unified report endpoint that handles both Firebase IDs and legacy bucket URLs.
 * Automatically detects the identifier type and routes accordingly.
 *
 * For Firebase IDs (20-char alphanumeric):
 * - Returns report status (queued/processing/finished/failed)
 * - Includes data URL when report is complete
 * - Includes metadata from Firestore
 *
 * For legacy bucket URLs (bucket/path format):
 * - Returns finished status with data URL
 * - No metadata (legacy reports predate metadata storage)
 *
 * @param req - Express request with logger and optional auth, expects identifier parameter
 * @param res - Express response
 * @returns JSON response with report status, dataUrl (when available), and metadata (for Firebase IDs)
 */
export async function getUnifiedReportHandler(
  req: RequestWithLogger & { auth?: DecodedIdToken },
  res: Response,
) {
  const identifier = req.params.identifier;

  // Determine URL type and add analytics/logging
  const isFirebaseId = isValidFirebaseId(identifier);
  const urlType = isFirebaseId ? "firebase_id" : "legacy_url";

  reportLogger.info(
    {
      identifier_hash: createIdentifierHash(identifier), // Privacy-safe hash
      identifier_length: identifier.length,
      urlType,
      isFirebaseId,
    },
    "Report access attempt",
  );

  // Track URL usage patterns with analytics
  try {
    const analytics = getAnalytics();
    if (analytics) {
      // Don't await analytics to avoid blocking the response
      analytics
        .track({
          name: "report_url_accessed",
          properties: {
            url_type: urlType,
            is_firebase_id: isFirebaseId,
            identifier_length: identifier.length,
            // Use privacy-safe hash instead of truncated identifier
            identifier_hash: createIdentifierHash(identifier),
            timestamp: Date.now(),
          },
          // Remove user context to prevent correlation with identifier patterns
        })
        .catch((error) => {
          // Analytics failures shouldn't break the request, but we want to know about them
          reportLogger.warn({ error }, "Analytics tracking failed");
        });
    }
  } catch (error) {
    // Analytics failures shouldn't break the request, but we want to know about them
    reportLogger.warn({ error }, "Analytics tracking failed");
  }

  if (isFirebaseId) {
    return handleIdBasedReport(identifier, req, res);
  } else {
    return handleLegacyReport(req, res);
  }
}

async function handleIdBasedReport(
  reportId: string,
  req: RequestWithLogger,
  res: Response,
) {
  try {
    const reportRef = await getReportRefById(reportId);
    if (!reportRef) {
      return sendError(res, 404, "Report not found", "ReportNotFound");
    }

    // ROBUST STATUS DETERMINATION - Single Source of Truth
    let status: api.ReportJobStatus;
    reportLogger.debug(
      {
        reportId,
        hasReportDataUri: !!reportRef.reportDataUri,
        reportDataUri: reportRef.reportDataUri,
        reportRefStatus: reportRef.status, // May not exist on legacy reports
        lastStatusUpdate: reportRef.lastStatusUpdate,
      },
      "Determining report status",
    );

    // Use authoritative status if available (new reports)
    if (hasAuthoritativeStatus(reportRef)) {
      reportLogger.debug(
        { reportId, authoritativeStatus: reportRef.status },
        "Using authoritative status from ReportRef",
      );
      const mappedStatus = mapAuthoritativeStatusToApiStatus(
        reportRef.status,
        reportRef.processingSubState,
        reportId,
      );

      // If mapping succeeded, use it; otherwise fall back to legacy logic
      if (mappedStatus) {
        status = mappedStatus;
      } else {
        reportLogger.warn(
          { reportId, unknownStatus: reportRef.status },
          "Unknown authoritative status, falling back to legacy logic",
        );
        status = await getLegacyStatus(reportRef, reportId, req);
      }
    } else {
      // Legacy reports without authoritative status - use existing logic
      reportLogger.debug(
        { reportId },
        "No authoritative status found, using legacy status determination",
      );
      status = await getLegacyStatus(reportRef, reportId, req);
    }

    if (isReportDataReady(status, reportRef.reportDataUri)) {
      // Report is complete - include data URL
      const parsed = parseGcsUri(reportRef.reportDataUri);
      if (!parsed) {
        return sendError(res, 500, "Invalid report data URI", "InvalidDataUri");
      }

      const env = req.context.env;

      // Validate bucket is allowed before attempting to get signed URL
      const allowedBuckets = env.ALLOWED_GCS_BUCKETS;
      if (!allowedBuckets.includes(parsed.bucket)) {
        reportLogger.error(
          {
            reportId,
            bucket: parsed.bucket,
            allowedBuckets: allowedBuckets.join(","),
            reportDataUri: reportRef.reportDataUri,
          },
          "Bucket not in allowed list for finished report",
        );
        return sendError(
          res,
          500,
          "Report storage bucket not authorized",
          "UnauthorizedBucket",
        );
      }

      const storage = new Bucket(env.GOOGLE_CREDENTIALS_ENCODED, parsed.bucket);
      const urlResult = await storage.getUrl(parsed.fileName);

      if (urlResult.tag === "failure") {
        reportLogger.error(
          {
            error: urlResult.error,
            reportId,
            bucket: parsed.bucket,
            fileName: parsed.fileName,
            reportDataUri: reportRef.reportDataUri,
          },
          "Failed to get signed URL for finished report",
        );
        return sendError(
          res,
          500,
          "Failed to generate report URL",
          "GetUrlError",
        );
      }

      res.set("Cache-Control", "private, max-age=60");
      return res.json({
        status: "finished",
        dataUrl: urlResult.value,
        metadata: reportRef,
      });
    } else {
      // Still processing or failed
      res.set("Cache-Control", "no-cache");
      return res.json({
        status,
        metadata: reportRef,
      });
    }
  } catch (error) {
    reportLogger.error({ error, reportId }, "Error getting ID-based report");
    return sendError(
      res,
      500,
      "Report service temporarily unavailable",
      "ReportServiceError",
    );
  }
}

async function handleLegacyReport(req: RequestWithLogger, res: Response) {
  // Add deprecation signaling for legacy URLs
  addDeprecationSignaling(res, "/report/:identifier (legacy)");

  // Use existing legacy parsing logic
  const parsed = getBucketAndFileName(req);
  if (parsed.tag === "failure") {
    return sendError(res, 404, "Report not found", "ReportNotFound");
  }

  try {
    const { bucket, fileName } = parsed.value;
    const env = req.context.env;
    const storage = new Bucket(env.GOOGLE_CREDENTIALS_ENCODED, bucket);
    const urlResult = await storage.getUrl(fileName);

    if (urlResult.tag === "failure") {
      reportLogger.error(
        { error: urlResult.error },
        "Failed to get signed URL for legacy report",
      );
      return sendError(
        res,
        500,
        "Failed to generate report URL",
        "GetUrlError",
      );
    }

    res.set("Cache-Control", "private, max-age=300"); // Legacy reports are stable
    return res.json({
      status: "finished",
      dataUrl: urlResult.value,
      // No metadata for legacy reports
    });
  } catch (error) {
    reportLogger.error({ error }, "Error getting legacy report");
    return sendError(res, 500, "Failed to generate report URL", "GetUrlError");
  }
}
