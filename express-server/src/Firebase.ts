import * as admin from "firebase-admin";
import { Env, validateEnv } from "./types/context";
import {
  ReportJob,
  ReportRef,
  useGetCollectionName,
  UserDocument,
  SCHEMA_VERSIONS,
} from "tttc-common/firebase";
import { logger } from "tttc-common/logger";
import { z } from "zod";
import { FIRESTORE_ID_REGEX, isValidReportUri } from "tttc-common/utils";

// Zod schemas for ID-based URL system validation
const reportIdSchema = z
  .string()
  .min(1)
  .regex(FIRESTORE_ID_REGEX, "Invalid Firebase ID format");
const jobIdSchema = z.string().min(1);
const userIdSchema = z.string().min(1);
const titleSchema = z.string().min(1);
const reportStatsSchema = z.object({
  numTopics: z.number().nonnegative(),
  numSubtopics: z.number().nonnegative(),
  numClaims: z.number().nonnegative(),
  numPeople: z.number().nonnegative(),
  title: z.string().min(1),
  description: z.string().optional(),
  createdDate: z.date().optional(),
});

const firebaseLogger = logger.child({ module: "firebase" });

const env: Env = validateEnv();

firebaseLogger.info("Environment validation successful, initializing Firebase");

const FIREBASE_CREDENTIALS = JSON.parse(
  Buffer.from(env.FIREBASE_CREDENTIALS_ENCODED, "base64").toString("utf-8"),
);

firebaseLogger.info("Firebase credentials parsed, creating admin app");

const app = admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_CREDENTIALS),
});

firebaseLogger.info("Firebase admin app initialized successfully");

const db = admin.firestore(app);

const auth = admin.auth(app);

const getCollectionName = useGetCollectionName(env.NODE_ENV);

// Export for use in other routes
export { db, admin, getCollectionName };

// Transaction helpers to reduce method complexity
async function updateDocumentWithValidation<T extends Record<string, any>>(
  docRef: admin.firestore.DocumentReference,
  updateData: T,
  notFoundMessage: string,
): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    if (!doc.exists) {
      throw new Error(notFoundMessage);
    }
    transaction.update(docRef, updateData);
  });
}

function createTimestamp(date: Date): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromDate(date);
}

function prepareReportRefData(
  reportRef: Omit<ReportRef, "jobId"> & { createdDate: Date },
  jobId: string,
  isNewDocument: boolean,
): any {
  const updateData: any = {
    ...reportRef,
    createdDate: createTimestamp(reportRef.createdDate),
    jobId: jobId,
  };

  if (isNewDocument) {
    updateData.schemaVersion = SCHEMA_VERSIONS.REPORT_REF;
  }

  return updateData;
}

function prepareJobData(jobDetails: ReportJob): any {
  return {
    ...jobDetails,
    createdAt: createTimestamp(jobDetails.createdAt || new Date()),
    schemaVersion: SCHEMA_VERSIONS.REPORT_JOB,
  };
}

function prepareReportRefForCreation(
  reportRefData: Omit<ReportRef, "jobId" | "id"> & { createdDate: Date },
  reportId: string,
  jobId: string,
): any {
  return {
    ...reportRefData,
    id: reportId,
    createdDate: createTimestamp(reportRefData.createdDate),
    jobId: jobId,
    status: "queued", // Set initial status
    lastStatusUpdate: createTimestamp(new Date()),
    schemaVersion: SCHEMA_VERSIONS.REPORT_REF,
  };
}

firebaseLogger.info(
  `Express Firebase.ts module loaded, NODE_ENV: ${env.NODE_ENV}`,
);

/**
 * Creates or updates a reportRef
 *
 * @param reportId - Stable ID for the report (used in URLs)
 * @param jobId - ID of the job that generated this report data
 * @param reportRef - Report reference data
 */
export async function addReportRef(
  reportId: string,
  jobId: string,
  reportRef: Omit<ReportRef, "jobId"> & {
    createdDate: Date;
  },
) {
  // Input validation
  reportIdSchema.parse(reportId);
  jobIdSchema.parse(jobId);

  const docRef = db.collection(getCollectionName("REPORT_REF")).doc(reportId);

  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    const updateData = prepareReportRefData(reportRef, jobId, !doc.exists);
    transaction.set(docRef, updateData, { merge: true });
  });

  return docRef.id;
}

/**
 * Adds a report job (processing report) and returns an id
 */
export async function addReportJob({
  createdAt = new Date(),
  ...jobDetails
}: ReportJob) {
  const docRef = db.collection(getCollectionName("REPORT_JOB")).doc();

  await docRef.set({
    ...jobDetails,
    createdAt: admin.firestore.Timestamp.fromDate(createdAt),
  });

  return docRef.id;
}

/**
 * Atomically creates both ReportJob and ReportRef documents in a single transaction
 * This prevents orphaned records and ensures data consistency
 */
export async function createReportJobAndRef(
  jobDetails: ReportJob,
  reportRefData: Omit<ReportRef, "jobId" | "id"> & {
    createdDate: Date;
  },
  reportId?: string, // Optional pre-generated reportId
): Promise<{ jobId: string; reportId: string }> {
  try {
    // Input validation
    userIdSchema.parse(reportRefData.userId);
    titleSchema.parse(reportRefData.title);

    const jobRef = db.collection(getCollectionName("REPORT_JOB")).doc();
    const reportRef = reportId
      ? db.collection(getCollectionName("REPORT_REF")).doc(reportId)
      : db.collection(getCollectionName("REPORT_REF")).doc();

    await db.runTransaction(async (transaction) => {
      try {
        const jobData = prepareJobData(jobDetails);
        const reportData = prepareReportRefForCreation(
          reportRefData,
          reportRef.id,
          jobRef.id,
        );

        transaction.set(jobRef, jobData);

        transaction.set(reportRef, reportData);
      } catch (transactionError) {
        firebaseLogger.error(
          {
            error: transactionError,
            errorMessage:
              transactionError instanceof Error
                ? transactionError.message
                : String(transactionError),
          },
          "Error inside transaction",
        );
        throw transactionError;
      }
    });

    firebaseLogger.info(
      {
        jobId: jobRef.id,
        reportId: reportRef.id,
        hasUserId: !!reportRefData.userId,
        hasTitle: !!reportRefData.title,
      },
      "Atomically created ReportJob and ReportRef",
    );

    return {
      jobId: jobRef.id,
      reportId: reportRef.id,
    };
  } catch (error) {
    firebaseLogger.error(
      {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        reportRefData: {
          userId: reportRefData.userId,
          title: reportRefData.title,
          hasReportDataUri: !!reportRefData.reportDataUri,
        },
      },
      "Failed to create ReportJob and ReportRef",
    );
    throw error;
  }
}

/**
 * Updates an existing ReportRef document with final report statistics
 * Used when the pipeline job completes to update placeholder values
 */
export async function updateReportRefWithStats(
  reportId: string,
  jobId: string,
  stats: {
    title: string;
    description?: string;
    numTopics: number;
    numSubtopics: number;
    numClaims: number;
    numPeople: number;
    createdDate?: Date;
  },
) {
  // Input validation
  reportIdSchema.parse(reportId);
  jobIdSchema.parse(jobId);
  reportStatsSchema.parse(stats);

  const docRef = db.collection(getCollectionName("REPORT_REF")).doc(reportId);

  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    if (!doc.exists) {
      throw new Error(`Report ref ${reportId} not found`);
    }

    const updateData: any = {
      numTopics: stats.numTopics,
      numSubtopics: stats.numSubtopics,
      numClaims: stats.numClaims,
      numPeople: stats.numPeople,
      title: stats.title, // Title is now required
      jobId: jobId, // Update job ID
    };

    // Only update description if provided
    if (stats.description) {
      updateData.description = stats.description;
    }
    if (stats.createdDate) {
      const timestamp = admin.firestore.Timestamp.fromDate(stats.createdDate);
      updateData.createdDate = timestamp;
    }

    transaction.update(docRef, updateData);
  });

  firebaseLogger.info(
    {
      reportId,
      jobId,
      numTopics: stats.numTopics,
      numSubtopics: stats.numSubtopics,
      numClaims: stats.numClaims,
      numPeople: stats.numPeople,
    },
    "Updated ReportRef with final statistics",
  );
}

export class JobNotFoundError extends Error {}

/**
 * Updates the reportDataUri of a report job document
 */
export async function updateReportJobDataUri(
  jobId: string,
  reportDataUri: string,
) {
  try {
    const docRef = db.collection(getCollectionName("REPORT_JOB")).doc(jobId);
    await updateDocumentWithValidation(
      docRef,
      { reportDataUri },
      `Report job ${jobId} not found`,
    );
    firebaseLogger.info({ jobId }, "Updated reportDataUri for job");
  } catch (error) {
    firebaseLogger.error(
      { error, jobId },
      "Failed to update reportDataUri for job",
    );
    throw error;
  }
}

/**
 * Updates the reportDataUri of a report ref document
 */
export async function updateReportRefDataUri(
  reportId: string,
  reportDataUri: string,
) {
  try {
    const docRef = db.collection(getCollectionName("REPORT_REF")).doc(reportId);
    await updateDocumentWithValidation(
      docRef,
      { reportDataUri },
      `Report ref ${reportId} not found`,
    );
    firebaseLogger.info({ reportId }, "Updated reportDataUri for report ref");
  } catch (error) {
    firebaseLogger.error(
      { error, reportId },
      "Failed to update reportDataUri for report ref",
    );
    throw error;
  }
}

interface StatusUpdateOptions {
  subState?: string;
  errorMessage?: string;
}

// Valid status values and transition rules
const VALID_STATUSES = [
  "created",
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const;
type ValidReportStatus = (typeof VALID_STATUSES)[number];

// Define valid status transitions to prevent invalid state changes
const VALID_STATUS_TRANSITIONS: Record<string, ValidReportStatus[]> = {
  created: ["queued", "failed"],
  queued: ["processing", "failed", "cancelled"],
  processing: ["completed", "failed", "cancelled"],
  completed: [], // Terminal state
  failed: ["queued"], // Allow retry
  cancelled: [], // Terminal state
};

function isValidStatusTransition(
  from: string | undefined,
  to: string,
): boolean {
  // If no current status, allow any valid status
  if (!from) return VALID_STATUSES.includes(to as ValidReportStatus);

  // Allow same-status transitions (for updating substates)
  if (from === to) return true;

  // Check if transition is allowed
  const allowedTransitions = VALID_STATUS_TRANSITIONS[from] || [];
  return allowedTransitions.includes(to as ValidReportStatus);
}

export function validateStatusValue(status: string): ValidReportStatus {
  if (!VALID_STATUSES.includes(status as ValidReportStatus)) {
    throw new Error(
      `Invalid status value: ${status}. Valid values: ${VALID_STATUSES.join(", ")}`,
    );
  }
  return status as ValidReportStatus;
}

/**
 * Normalizes the legacy string parameter into a proper options object
 */
function normalizeStatusUpdateOptions(
  status: string,
  optionsOrLegacyString: StatusUpdateOptions | string,
): StatusUpdateOptions {
  if (typeof optionsOrLegacyString === "string") {
    return status === "processing"
      ? { subState: optionsOrLegacyString }
      : { errorMessage: optionsOrLegacyString };
  }
  return optionsOrLegacyString;
}

/**
 * Builds the update data object for Firestore transaction
 */
function buildStatusUpdateData(
  validatedStatus: ValidReportStatus,
  options: StatusUpdateOptions,
  currentStatus: string | undefined,
): { [key: string]: any } {
  const updateData: { [key: string]: any } = {
    status: validatedStatus,
    lastStatusUpdate: createTimestamp(new Date()),
    processingSubState: options.subState || null,
  };

  // Add error message if provided
  if (options.errorMessage) {
    updateData.errorMessage = options.errorMessage;
  }

  // Clear error message when transitioning away from failed status
  if (currentStatus === "failed" && validatedStatus !== "failed") {
    updateData.errorMessage = "";
  }

  return updateData;
}

/**
 * Logs successful status transition
 */
function logStatusTransition(
  reportId: string,
  validatedStatus: ValidReportStatus,
  currentStatus: string | undefined,
  processingSubState: string | null,
): void {
  firebaseLogger.info(
    {
      reportId,
      status: validatedStatus,
      previousStatus: currentStatus,
      processingSubState,
      transitionTime: new Date().toISOString(),
    },
    "Status transition completed successfully",
  );
}

/**
 * Updates the status of a report ref document with validation and transaction safety
 *
 * @param reportId - The Firebase document ID of the report
 * @param status - The new status to set (must be a valid transition)
 * @param optionsOrLegacyString - Either StatusUpdateOptions object or legacy string parameter
 *
 * @example
 * // Basic status update
 * await updateReportRefStatus("report123", "completed");
 *
 * // With sub-state for processing
 * await updateReportRefStatus("report123", "processing", { subState: "clustering" });
 *
 * // With error message for failed status
 * await updateReportRefStatus("report123", "failed", { errorMessage: "Processing error" });
 *
 * @throws {Error} If the report document is not found
 * @throws {Error} If the status value is invalid
 * @throws {Error} If the status transition is not allowed
 */
// Overloaded function signatures for backward compatibility
export async function updateReportRefStatus(
  reportId: string,
  status: string,
  errorMessageOrSubState?: string,
): Promise<void>;
export async function updateReportRefStatus(
  reportId: string,
  status: string,
  options: StatusUpdateOptions,
): Promise<void>;
export async function updateReportRefStatus(
  reportId: string,
  status: string,
  optionsOrLegacyString: StatusUpdateOptions | string = {},
) {
  try {
    // Validate status value first
    const validatedStatus = validateStatusValue(status);

    // Handle both legacy string parameter and new options object
    const options = normalizeStatusUpdateOptions(status, optionsOrLegacyString);

    const docRef = db.collection(getCollectionName("REPORT_REF")).doc(reportId);

    // Use transaction for safe status updates with validation
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) {
        throw new Error(`Report ref ${reportId} not found`);
      }

      const currentData = doc.data();
      const currentStatus = currentData?.status;

      // Validate status transition
      if (!isValidStatusTransition(currentStatus, validatedStatus)) {
        firebaseLogger.warn(
          { reportId, currentStatus, attemptedStatus: validatedStatus },
          "Invalid status transition attempted",
        );
        throw new Error(
          `Invalid status transition: ${currentStatus} → ${validatedStatus}`,
        );
      }

      // Build update data and apply transaction
      const updateData = buildStatusUpdateData(
        validatedStatus,
        options,
        currentStatus,
      );
      transaction.update(docRef, updateData);

      // Log successful transition
      logStatusTransition(
        reportId,
        validatedStatus,
        currentStatus,
        updateData.processingSubState,
      );
    });
  } catch (error) {
    firebaseLogger.error(
      {
        error,
        reportId,
        status,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      "Failed to update status for report ref",
    );
    throw error;
  }
}

/**
 * Wrapper for updateReportRefStatus with retry logic and standardized error handling
 * Use this in critical contexts like workers and pipelines where status updates must succeed
 *
 * @param reportId - The Firebase document ID of the report
 * @param status - The new status to set (must be a valid transition)
 * @param options - Optional sub-state and error message parameters
 * @param retries - Number of retry attempts (default: 2)
 *
 * @throws {Error} If all retry attempts fail after exponential backoff
 * @throws {Error} If the report document is not found (propagated from updateReportRefStatus)
 * @throws {Error} If the status value is invalid (propagated from updateReportRefStatus)
 * @throws {Error} If the status transition is not allowed (propagated from updateReportRefStatus)
 */
export async function updateReportRefStatusWithRetry(
  reportId: string,
  status: ValidReportStatus,
  options?: { subState?: string; errorMessage?: string },
  retries = 2,
): Promise<void> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (options?.errorMessage) {
        await updateReportRefStatus(reportId, status, options.errorMessage);
      } else if (options?.subState) {
        await updateReportRefStatus(reportId, status, {
          subState: options.subState,
        });
      } else {
        await updateReportRefStatus(reportId, status);
      }
      return; // Success
    } catch (error) {
      firebaseLogger.warn(
        {
          error,
          reportId,
          status,
          attempt: attempt + 1,
          maxRetries: retries,
          options,
        },
        `Status update attempt ${attempt + 1} failed`,
      );

      if (attempt === retries - 1) {
        // Final attempt failed - log and throw
        firebaseLogger.error(
          { error, reportId, status, totalAttempts: retries, options },
          "Status update failed after all retries",
        );
        throw error;
      }

      // Wait before retry with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function verifyUser(token: string) {
  return await auth.verifyIdToken(token);
}

/**
 * Profile data for progressive profiling (monday.com CRM integration)
 */
export interface ProfileUpdateData {
  company?: string;
  title?: string;
  phone?: string;
  useCase?: string;
  newsletterOptIn?: boolean;
}

// ============================================================================
// Profile Data Helpers
// ============================================================================

/** Check if any substantive profile field is set (excludes newsletterOptIn). */
function hasAnyProfileField(profileData: ProfileUpdateData): boolean {
  return !!(
    profileData.company ||
    profileData.title ||
    profileData.phone ||
    profileData.useCase
  );
}

/** Apply profile data to a new user record. */
function applyProfileToNewUser(
  userData: Record<string, unknown>,
  profileData: ProfileUpdateData,
): void {
  if (profileData.company) userData.company = profileData.company;
  if (profileData.title) userData.title = profileData.title;
  if (profileData.phone) userData.phone = profileData.phone;
  if (profileData.useCase) userData.useCase = profileData.useCase;
  if (profileData.newsletterOptIn !== undefined) {
    userData.newsletterOptIn = profileData.newsletterOptIn;
  }
  if (hasAnyProfileField(profileData)) {
    userData.profileCompletedAt = admin.firestore.FieldValue.serverTimestamp();
  }
}

/** Build update fields from profile data for existing user. */
function buildProfileUpdateFields(
  profileData: ProfileUpdateData,
  existingProfileCompletedAt: unknown,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  if (profileData.company !== undefined) fields.company = profileData.company;
  if (profileData.title !== undefined) fields.title = profileData.title;
  if (profileData.phone !== undefined) fields.phone = profileData.phone;
  if (profileData.useCase !== undefined) fields.useCase = profileData.useCase;
  if (profileData.newsletterOptIn !== undefined) {
    fields.newsletterOptIn = profileData.newsletterOptIn;
  }

  // Mark profile completion if this is the first time
  if (!existingProfileCompletedAt && hasAnyProfileField(profileData)) {
    fields.profileCompletedAt = admin.firestore.FieldValue.serverTimestamp();
  }

  return fields;
}

/** Convert Firestore timestamps to Date objects in user document. */
function convertUserTimestamps(
  userData: FirebaseFirestore.DocumentData,
): UserDocument {
  return {
    ...userData,
    createdAt: userData.createdAt?.toDate() || new Date(),
    lastLoginAt: userData.lastLoginAt?.toDate() || new Date(),
    profileCompletedAt: userData.profileCompletedAt?.toDate(),
  } as unknown as UserDocument;
}

export interface EnsureUserResult {
  user: UserDocument;
  isNew: boolean;
}

export async function ensureUserDocument(
  firebaseUid: string,
  email: string | null = null,
  displayName: string | null = null,
  profileData?: ProfileUpdateData,
): Promise<EnsureUserResult> {
  firebaseLogger.debug(
    { firebaseUid, email, displayName, hasProfileData: !!profileData },
    "ensureUserDocument called",
  );

  try {
    const userRef = db.collection(getCollectionName("USERS")).doc(firebaseUid);
    const userDoc = await userRef.get();
    const isNew = !userDoc.exists;

    if (isNew) {
      await createNewUserDocument(
        userRef,
        firebaseUid,
        email,
        displayName,
        profileData,
      );
    } else {
      await updateExistingUserDocument(
        userRef,
        userDoc,
        email,
        displayName,
        profileData,
      );
    }

    // Fetch and return the updated user document
    const updatedUserDoc = await userRef.get();
    const userData = updatedUserDoc.data();

    if (!userData) {
      throw new Error(
        `User document not found after ensuring it exists for ${firebaseUid}`,
      );
    }

    return { user: convertUserTimestamps(userData), isNew };
  } catch (error) {
    firebaseLogger.error({ error }, "Error ensuring user document");
    throw new Error(
      `Failed to ensure user document for ${firebaseUid}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/** Create a new user document with optional profile data. */
async function createNewUserDocument(
  userRef: FirebaseFirestore.DocumentReference,
  firebaseUid: string,
  email: string | null,
  displayName: string | null,
  profileData?: ProfileUpdateData,
): Promise<void> {
  const newUserData: Record<string, unknown> = {
    firebaseUid,
    email,
    displayName,
    isValid: true, // Set to false to ban/disable user
    roles: ["user"],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (profileData) {
    applyProfileToNewUser(newUserData, profileData);
  }

  await userRef.set({
    ...newUserData,
    schemaVersion: SCHEMA_VERSIONS.USER_DOCUMENT,
  });
}

/** Update an existing user document with changed fields and optional profile data. */
async function updateExistingUserDocument(
  userRef: FirebaseFirestore.DocumentReference,
  userDoc: FirebaseFirestore.DocumentSnapshot,
  email: string | null,
  displayName: string | null,
  profileData?: ProfileUpdateData,
): Promise<void> {
  const currentData = userDoc.data();
  const updateData: Record<string, unknown> = {
    lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Update email and displayName if changed
  if (email && currentData?.email !== email) {
    updateData.email = email;
  }
  if (displayName && currentData?.displayName !== displayName) {
    updateData.displayName = displayName;
  }

  // Merge profile updates
  if (profileData) {
    const profileFields = buildProfileUpdateFields(
      profileData,
      currentData?.profileCompletedAt,
    );
    Object.assign(updateData, profileFields);
  }

  await userRef.update(updateData);
}

/**
 * Finds a ReportRef document by its reportDataUri
 * Used for migrating legacy URLs to new ID-based URLs
 * Returns null on not-found, throws on system errors for better debugging
 */
export async function findReportRefByUri(
  reportDataUri: string,
): Promise<{ id: string; data: ReportRef } | null> {
  // Input validation
  if (!isValidReportUri(reportDataUri)) {
    firebaseLogger.debug("Invalid or empty reportDataUri provided");
    return null;
  }

  try {
    const collection = db.collection(getCollectionName("REPORT_REF"));
    // Performance hint: This query uses the reportDataUri index for fast lookups
    // Ensure firestore.indexes.json includes single-field index on reportDataUri
    const query = await collection
      .where("reportDataUri", "==", reportDataUri)
      .limit(1)
      .get();

    if (query.empty) {
      firebaseLogger.debug(
        { hasUri: !!reportDataUri },
        "No ReportRef found for URI",
      );
      return null;
    }

    const doc = query.docs[0];
    const data = doc.data();

    firebaseLogger.debug(
      {
        docId: doc.id,
        hasTitle: !!data.title,
      },
      "Found ReportRef for URI",
    );

    return {
      id: doc.id,
      data: data as ReportRef,
    };
  } catch (error) {
    firebaseLogger.error(
      { error, hasUri: !!reportDataUri },
      "Firebase error finding ReportRef by URI",
    );
    // For migration endpoints, system errors should be handled by caller
    // to distinguish from legitimate "not found" cases
    throw error;
  }
}

/**
 * Gets a ReportRef document by its Firebase document ID
 * Used for accessing reports by their Firebase document ID
 * Returns null on not-found or internal error (caller treats uniformly)
 */
export async function getReportRefById(
  reportId: string,
): Promise<ReportRef | null> {
  try {
    const docRef = db.collection(getCollectionName("REPORT_REF")).doc(reportId);
    const doc = await docRef.get();

    if (!doc.exists) {
      firebaseLogger.debug(
        { hasReportId: !!reportId },
        "No ReportRef found for ID",
      );
      return null;
    }

    const data = doc.data();
    firebaseLogger.debug(
      {
        hasReportId: !!reportId,
        hasTitle: !!data?.title,
      },
      "Found ReportRef for ID",
    );

    return data as ReportRef;
  } catch (error) {
    firebaseLogger.error({ error }, "Error getting ReportRef by ID");
    return null;
  }
}

/**
 * Determines if a report uses legacy or ID-based URL system
 * Single source of truth for version detection based on filename
 */
export function getReportVersion(reportRef: ReportRef): "legacy" | "id:v1" {
  const filename = reportRef.reportDataUri
    ?.split("/")
    .pop()
    ?.replace(".json", "");

  // Firebase auto-generated IDs are exactly 20 characters, alphanumeric
  return filename && FIRESTORE_ID_REGEX.test(filename) ? "id:v1" : "legacy";
}
