import { createHash } from "node:crypto";
import type { Response } from "express";
import { getAnalytics } from "tttc-common/analytics";
import * as api from "tttc-common/api";
import { ERROR_CODES } from "tttc-common/errors";
import {
  asReportId,
  type ProcessingSubState,
  type ReportId,
  type ReportRef,
  type ReportStatus,
} from "tttc-common/firebase";
import type { Result } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import { FIRESTORE_ID_REGEX } from "tttc-common/utils";
import {
  db,
  findReportRefByUri,
  getCollectionName,
  getReportRefById,
} from "../Firebase";
import { checkReportAccess } from "../lib/reportPermissions";
import { Bucket } from "../storage";
import type { Env } from "../types/context";
import type {
  RequestWithLogger,
  RequestWithOptionalAuth,
} from "../types/request";
import { sendErrorByCode } from "./sendError";

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
 * Detects if a report is completed based on metadata indicators
 * Uses fast heuristics first, avoids expensive file reads when possible
 */
function isReportCompletedByMetadata(reportRef: ReportRef): boolean {
  // Fast metadata checks only - no file I/O
  return !!(
    reportRef.reportDataUri &&
    reportRef.reportDataUri.trim() !== "" &&
    reportRef.reportDataUri.startsWith("https://storage.googleapis.com/") &&
    typeof reportRef.numTopics === "number" &&
    typeof reportRef.numClaims === "number" &&
    reportRef.numTopics > 0 &&
    reportRef.numClaims > 0
  );
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
  const match = uri.match(/https:\/\/storage\.googleapis\.com\/([^/]+)\/(.+)/);
  if (!match) return null;
  return { bucket: match[1], fileName: match[2] };
}

/**
 * Validated GCS URI with bucket and file name extracted
 */
interface ValidatedGcsUri {
  bucket: string;
  fileName: string;
}

/**
 * Validates a GCS URI for report data access.
 * Consolidates all URI validation: existence, format, parsing, and bucket allowlist.
 *
 * @param reportDataUri - The URI to validate
 * @param allowedBuckets - List of allowed bucket names
 * @param reportId - Report ID for logging
 * @returns Result with validated URI components or failure with error message
 */
function validateGcsUri(
  reportDataUri: string | undefined,
  allowedBuckets: string[],
  reportId: ReportId,
): Result<ValidatedGcsUri, string> {
  // Check URI exists and is non-empty
  if (!reportDataUri || reportDataUri.trim() === "") {
    reportLogger.debug(
      { reportId },
      "URI validation failed: No reportDataUri found",
    );
    return { tag: "failure", error: "No reportDataUri found" };
  }

  // Check URI format
  if (!reportDataUri.startsWith("https://storage.googleapis.com/")) {
    reportLogger.warn(
      { reportId, invalidUri: reportDataUri },
      "URI validation failed: Invalid URI format",
    );
    return { tag: "failure", error: "Invalid URI format" };
  }

  // Parse URI
  const parsed = parseGcsUri(reportDataUri);
  if (!parsed) {
    reportLogger.warn(
      { reportId, invalidUri: reportDataUri },
      "URI validation failed: Could not parse GCS URI",
    );
    return { tag: "failure", error: "Could not parse GCS URI" };
  }

  // Validate bucket is in allowed list
  if (!allowedBuckets.includes(parsed.bucket)) {
    reportLogger.warn(
      {
        reportId,
        bucket: parsed.bucket,
        allowedBuckets: allowedBuckets.join(","),
        reportDataUri,
      },
      "URI validation failed: Bucket not in allowed list",
    );
    return { tag: "failure", error: "Bucket not in allowed list" };
  }

  return { tag: "success", value: parsed };
}

/**
 * Lookup table for mapping authoritative status to API status.
 * Excludes "processing" which uses sub-state mapping.
 */
const AUTHORITATIVE_STATUS_MAP: Partial<
  Record<ReportStatus, api.ReportJobStatus>
> = {
  created: api.reportJobStatus.enum.queued,
  queued: api.reportJobStatus.enum.queued,
  completed: api.reportJobStatus.enum.finished,
  failed: api.reportJobStatus.enum.failed,
  cancelled: api.reportJobStatus.enum.failed, // Treat cancelled as failed for API consistency
};

/**
 * Maps processing sub-state to API status.
 * Sub-states like "clustering", "extraction" map directly to API status values.
 */
function resolveProcessingSubState(
  subState: ProcessingSubState,
): api.ReportJobStatus {
  if (subState && subState in api.reportJobStatus.enum) {
    return api.reportJobStatus.enum[subState];
  }
  return api.reportJobStatus.enum.clustering;
}

/**
 * Maps authoritative ReportRef status to API status values.
 * Uses typed ReportStatus and ProcessingSubState for type safety.
 */
function mapAuthoritativeStatusToApiStatus(
  authoritativeStatus: ReportStatus,
  subState: ProcessingSubState,
  reportId: ReportId,
): api.ReportJobStatus | null {
  // Handle processing status specially - uses sub-state
  if (authoritativeStatus === "processing") {
    return resolveProcessingSubState(subState);
  }

  // Use lookup table for other statuses
  const mappedStatus = AUTHORITATIVE_STATUS_MAP[authoritativeStatus];
  if (mappedStatus) {
    return mappedStatus;
  }

  // Unknown status - should not happen with typed input
  reportLogger.warn(
    { reportId, authoritativeStatus },
    "Unknown authoritative status value",
  );
  return null;
}

/**
 * Validates if file contains actual report data vs placeholder
 */
async function validateReportFileContent(
  storage: Bucket,
  fileName: string,
  reportId: ReportId,
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
 * Determines report status from file existence and content validation.
 * This is the "slow path" for legacy reports without job status.
 *
 * @param validatedUri - Pre-validated GCS URI with bucket and fileName
 * @param credentials - Google Cloud credentials
 * @param reportId - Report ID for logging
 * @returns API status based on file existence and content validity
 */
async function determineStatusFromFile(
  validatedUri: ValidatedGcsUri,
  credentials: string,
  reportId: ReportId,
): Promise<api.ReportJobStatus> {
  try {
    const storage = new Bucket(credentials, validatedUri.bucket);
    const fileExists = await storage.fileExists(validatedUri.fileName);

    if (!fileExists) {
      reportLogger.debug(
        { reportId },
        "Legacy: File does not exist - report likely failed",
      );
      return api.reportJobStatus.enum.failed;
    }

    // File exists - validate contents to ensure it's a real report
    const isValid = await validateReportFileContent(
      storage,
      validatedUri.fileName,
      reportId,
    );

    if (!isValid) {
      reportLogger.debug(
        { reportId },
        "Legacy: File exists but contains invalid content",
      );
      return api.reportJobStatus.enum.failed;
    }

    // File exists and has valid content - report is finished
    reportLogger.debug(
      { reportId },
      "Legacy: Valid report file found - status is finished",
    );
    return api.reportJobStatus.enum.finished;
  } catch (error) {
    reportLogger.error(
      { reportId, error, bucket: validatedUri.bucket },
      "Legacy: Error checking file existence",
    );
    return api.reportJobStatus.enum.failed;
  }
}

/**
 * Gets the status from a REPORT_JOB document (legacy fallback)
 */
async function getReportJobStatus(jobId: string): Promise<string | null> {
  try {
    const doc = await db
      .collection(getCollectionName("REPORT_JOB"))
      .doc(jobId)
      .get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data();
    return data?.status || null;
  } catch (error) {
    reportLogger.debug({ jobId, error }, "Failed to get REPORT_JOB status");
    return null;
  }
}

/**
 * Maps legacy REPORT_JOB status to API status values
 */
function mapJobStatusToApiStatus(jobStatus: string): api.ReportJobStatus {
  switch (jobStatus) {
    case "pending":
      return api.reportJobStatus.enum.queued;
    case "finished":
      return api.reportJobStatus.enum.finished;
    case "failed":
      return api.reportJobStatus.enum.failed;
    default:
      reportLogger.debug(
        { jobStatus },
        "Unknown REPORT_JOB status, defaulting to failed",
      );
      return api.reportJobStatus.enum.failed;
  }
}

/**
 * Determines status for legacy reports that don't have authoritative status in REPORT_REF.
 * Uses efficient fallback chain: REPORT_JOB status -> file checks -> failed.
 *
 * Refactored to use extracted helpers for reduced complexity.
 */
async function determineLegacyStatus(
  reportRef: ReportRef,
  reportId: ReportId,
  req: RequestWithLogger,
): Promise<api.ReportJobStatus> {
  reportLogger.debug(
    { reportId },
    "Legacy: Determining status for report without authoritative status",
  );

  // FAST PATH: Check REPORT_JOB status first (most legacy reports will have this)
  if (reportRef.jobId) {
    const jobStatus = await getReportJobStatus(reportRef.jobId);
    if (jobStatus) {
      reportLogger.debug(
        { reportId, jobId: reportRef.jobId, jobStatus },
        "Legacy: Found REPORT_JOB status, using as authoritative",
      );
      return mapJobStatusToApiStatus(jobStatus);
    }
  }

  // SLOW PATH: Validate URI and check file
  reportLogger.debug(
    { reportId },
    "Legacy: No REPORT_JOB status found, checking file existence",
  );

  const uriResult = validateGcsUri(
    reportRef.reportDataUri,
    req.context.env.ALLOWED_GCS_BUCKETS,
    reportId,
  );

  if (uriResult.tag === "failure") {
    return api.reportJobStatus.enum.failed;
  }

  return determineStatusFromFile(
    uriResult.value,
    req.context.env.GOOGLE_CREDENTIALS_ENCODED,
    reportId,
  );
}

/**
 * Response data for a finished report with data URL
 */
interface FinishedReportResponse {
  status: "finished";
  dataUrl: string;
  metadata: ReportRef;
}

/**
 * Response data for an in-progress or failed report
 */
interface InProgressReportResponse {
  status: api.ReportJobStatus;
  metadata: ReportRef;
}

/**
 * Builds response for a finished report, including signed URL generation.
 *
 * @param reportRef - The report reference from Firestore
 * @param env - Environment configuration
 * @param reportId - Report ID for logging
 * @returns Success with response data, or failure with error code
 */
/**
 * Fetches the actual report data from GCS.
 * Used when client requests includeData=true to avoid CORS issues.
 */
async function fetchReportData(
  reportDataUri: string | undefined,
  env: Env,
  reportId: ReportId,
): Promise<Result<unknown, (typeof ERROR_CODES)[keyof typeof ERROR_CODES]>> {
  if (!reportDataUri) {
    return { tag: "failure", error: ERROR_CODES.STORAGE_ERROR };
  }

  const uriResult = validateGcsUri(
    reportDataUri,
    env.ALLOWED_GCS_BUCKETS,
    reportId,
  );

  if (uriResult.tag === "failure") {
    reportLogger.error({ error: uriResult.error }, "URI validation failed");
    return { tag: "failure", error: ERROR_CODES.STORAGE_ERROR };
  }

  const storage = new Bucket(
    env.GOOGLE_CREDENTIALS_ENCODED,
    uriResult.value.bucket,
  );
  const dataResult = await storage.get(uriResult.value.fileName);

  if (dataResult.tag === "failure") {
    reportLogger.error(
      {
        error: dataResult.error,
        bucket: uriResult.value.bucket,
        fileName: uriResult.value.fileName,
      },
      "Failed to fetch report data from GCS",
    );
    return { tag: "failure", error: ERROR_CODES.STORAGE_ERROR };
  }

  return { tag: "success", value: dataResult.value };
}

async function buildFinishedReportResponse(
  reportRef: ReportRef,
  env: Env,
  reportId: ReportId,
): Promise<
  Result<FinishedReportResponse, (typeof ERROR_CODES)[keyof typeof ERROR_CODES]>
> {
  const uriResult = validateGcsUri(
    reportRef.reportDataUri,
    env.ALLOWED_GCS_BUCKETS,
    reportId,
  );

  if (uriResult.tag === "failure") {
    reportLogger.error(
      { reportId, error: uriResult.error },
      "URI validation failed for finished report",
    );
    return { tag: "failure", error: ERROR_CODES.STORAGE_ERROR };
  }

  const storage = new Bucket(
    env.GOOGLE_CREDENTIALS_ENCODED,
    uriResult.value.bucket,
  );
  const urlResult = await storage.getUrl(uriResult.value.fileName);

  if (urlResult.tag === "failure") {
    reportLogger.error(
      {
        error: urlResult.error,
        reportId,
        bucket: uriResult.value.bucket,
        fileName: uriResult.value.fileName,
        reportDataUri: reportRef.reportDataUri,
      },
      "Failed to get signed URL for finished report",
    );
    return { tag: "failure", error: ERROR_CODES.STORAGE_ERROR };
  }

  return {
    tag: "success",
    value: {
      status: "finished",
      dataUrl: urlResult.value,
      metadata: reportRef,
    },
  };
}

/**
 * Builds response for an in-progress or failed report.
 */
function buildInProgressResponse(
  status: api.ReportJobStatus,
  reportRef: ReportRef,
): InProgressReportResponse {
  return { status, metadata: reportRef };
}

/**
 * Resolves the status of a report using authoritative status or legacy heuristics.
 *
 * @param reportRef - The report reference from Firestore
 * @param reportId - Report ID for logging
 * @param req - Request with logger and environment context
 * @returns The resolved API status
 */
async function resolveReportStatus(
  reportRef: ReportRef,
  reportId: ReportId,
  req: RequestWithLogger,
): Promise<api.ReportJobStatus> {
  reportLogger.debug(
    {
      reportId,
      hasReportDataUri: !!reportRef.reportDataUri,
      reportRefStatus: reportRef.status,
    },
    "Determining report status",
  );

  // Use authoritative status from ReportRef (single source of truth)
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
    return mappedStatus || api.reportJobStatus.enum.failed;
  }

  // Legacy reports: use heuristics
  reportLogger.info(
    { reportId },
    "No authoritative status field - falling back to legacy report heuristics",
  );

  // Check if report is completed based on metadata indicators
  if (isReportCompletedByMetadata(reportRef)) {
    reportLogger.info(
      {
        reportId,
        numTopics: reportRef.numTopics,
        numClaims: reportRef.numClaims,
        hasReportDataUri: !!reportRef.reportDataUri,
      },
      "Legacy heuristic: Report detected as completed with validated file content",
    );
    return api.reportJobStatus.enum.finished;
  }

  // Fall back to legacy status determination
  reportLogger.info(
    { reportId },
    "Legacy heuristic: Metadata incomplete - checking file existence status",
  );
  return determineLegacyStatus(reportRef, reportId, req);
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
  } catch (_error) {
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
  req: RequestWithOptionalAuth,
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
    return sendErrorByCode(res, ERROR_CODES.INVALID_REPORT_URI, reportLogger);
  }

  const { bucket, fileName } = parsed.value;
  const reportDataUri = `https://storage.googleapis.com/${bucket}/${fileName}`;

  try {
    // Search Firebase for ReportRef with matching reportDataUri
    const reportRef = await findReportRefByUri(reportDataUri);

    if (reportRef) {
      // Check if user has permission to view this report
      const requestingUserId = req.auth?.uid;
      const access = checkReportAccess(reportRef.data, requestingUserId);

      if (!access.allowed) {
        // Return "not found" to not reveal existence of private reports
        const response: api.MigrationApiResponse = {
          success: false,
          message: "No document found for this legacy URL",
        };
        res.set("Cache-Control", "private, max-age=1800");
        return res.json(response);
      }

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
    sendErrorByCode(res, ERROR_CODES.SERVICE_UNAVAILABLE, reportLogger);
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
  req: RequestWithOptionalAuth,
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
    return handleIdBasedReport(asReportId(identifier), req, res);
  } else {
    return handleLegacyReport(req, res);
  }
}

async function handleIdBasedReport(
  reportId: ReportId,
  req: RequestWithOptionalAuth,
  res: Response,
) {
  try {
    reportLogger.info(
      {
        reportId,
        queryParams: req.query,
        includeDataParam: req.query.includeData,
        url: req.url,
      },
      "handleIdBasedReport called",
    );

    const reportRef = await getReportRefById(reportId);
    if (!reportRef) {
      return sendErrorByCode(res, ERROR_CODES.REPORT_NOT_FOUND, reportLogger);
    }

    // Check if user has permission to view this report
    const requestingUserId = req.auth?.uid;
    const access = checkReportAccess(reportRef, requestingUserId);

    reportLogger.info(
      {
        reportId,
        requestingUserId,
        reportOwnerId: reportRef.userId,
        isPublic: reportRef.isPublic,
        accessAllowed: access.allowed,
        accessReason: access.reason,
      },
      "Report access check",
    );

    if (!access.allowed) {
      // Return 404 to not reveal existence of private reports
      return sendErrorByCode(res, ERROR_CODES.REPORT_NOT_FOUND, reportLogger);
    }

    // Determine if the requesting user is the owner (for UI controls)
    const isOwner = requestingUserId === reportRef.userId;

    const status = await resolveReportStatus(reportRef, reportId, req);

    if (isReportDataReady(status, reportRef.reportDataUri)) {
      const result = await buildFinishedReportResponse(
        reportRef,
        req.context.env,
        reportId,
      );

      if (result.tag === "failure") {
        return sendErrorByCode(res, result.error, reportLogger);
      }

      // Check if client wants the actual report data included (to avoid CORS issues)
      const includeData = req.query.includeData === "true";
      reportLogger.info(
        { includeData, queryParam: req.query.includeData, reportId },
        "Checking includeData query parameter",
      );

      if (includeData) {
        // Fetch and include the actual report data
        reportLogger.info({ reportId }, "Fetching report data from GCS");
        const reportDataResult = await fetchReportData(
          reportRef.reportDataUri,
          req.context.env,
          reportId,
        );

        if (reportDataResult.tag === "failure") {
          reportLogger.error(
            { reportId, error: reportDataResult.error },
            "Failed to fetch report data",
          );
          return sendErrorByCode(res, reportDataResult.error, reportLogger);
        }

        reportLogger.info(
          { reportId, hasData: !!reportDataResult.value },
          "Successfully fetched report data, returning with reportData field",
        );
        res.set("Cache-Control", "private, max-age=60");
        return res.json({
          ...result.value,
          isOwner,
          reportData: reportDataResult.value,
        });
      }

      res.set("Cache-Control", "private, max-age=60");
      return res.json({ ...result.value, isOwner });
    }

    res.set("Cache-Control", "no-cache");
    return res.json({ ...buildInProgressResponse(status, reportRef), isOwner });
  } catch (error) {
    reportLogger.error({ error, reportId }, "Error getting ID-based report");
    return sendErrorByCode(res, ERROR_CODES.SERVICE_UNAVAILABLE, reportLogger);
  }
}

async function handleLegacyReport(req: RequestWithLogger, res: Response) {
  // Add deprecation signaling for legacy URLs
  addDeprecationSignaling(res, "/report/:identifier (legacy)");

  // Use existing legacy parsing logic
  const parsed = getBucketAndFileName(req);
  if (parsed.tag === "failure") {
    return sendErrorByCode(res, ERROR_CODES.REPORT_NOT_FOUND, reportLogger);
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
      return sendErrorByCode(res, ERROR_CODES.STORAGE_ERROR, reportLogger);
    }

    res.set("Cache-Control", "private, max-age=300"); // Legacy reports are stable
    return res.json({
      status: "finished",
      dataUrl: urlResult.value,
      // No metadata for legacy reports
    });
  } catch (error) {
    reportLogger.error({ error }, "Error getting legacy report");
    return sendErrorByCode(res, ERROR_CODES.STORAGE_ERROR, reportLogger);
  }
}
