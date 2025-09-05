import * as admin from "firebase-admin";
import { Env, validateEnv } from "./types/context";
import {
  ReportJob,
  ReportRef,
  JobStatus,
  useGetCollectionName,
  JOB_STATUS,
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
  Buffer.from(env.FIREBASE_CREDENTIALS_ENCODED!, "base64").toString("utf-8"),
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
    status: jobDetails.status || JOB_STATUS.PENDING,
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
  status = JOB_STATUS.PENDING,
  createdAt = new Date(),
  ...jobDetails
}: ReportJob) {
  const docRef = db.collection(getCollectionName("REPORT_JOB")).doc();

  // There's no way to parse a return result?
  await docRef.set({
    ...jobDetails,
    createdAt: admin.firestore.Timestamp.fromDate(createdAt),
    status,
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
 * Updates the status of a job doc. Returns void.
 */
export async function updateReportJobStatus(jobId: string, status: JobStatus) {
  try {
    const docRef = db.collection(getCollectionName("REPORT_JOB")).doc(jobId);

    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) {
        throw new Error(`Report job ${jobId} not found`);
      }
      transaction.update(docRef, { status });
    });
  } catch (e) {
    // preserve original error for better stack traces
    if (e instanceof JobNotFoundError) {
      throw e;
    }
    const message = e instanceof Error ? e.message : e?.toString();
    throw new Error(`Failed to update job status: ${message}`);
  }
}

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

export async function verifyUser(token: string) {
  return await auth.verifyIdToken(token);
}

export async function ensureUserDocument(
  firebaseUid: string,
  email: string | null = null,
  displayName: string | null = null,
): Promise<UserDocument> {
  firebaseLogger.debug(
    {
      firebaseUid,
      email,
      displayName,
    },
    "ensureUserDocument called",
  );
  try {
    const userRef = db.collection(getCollectionName("USERS")).doc(firebaseUid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // Create new user document
      const newUserData = {
        firebaseUid,
        email,
        displayName,
        isValid: true, // This user is allowed to login, set to false to ban/disable.
        isWaitlistApproved: false, // User is waiting to be approved on the waitlist.
        roles: ["user"],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await userRef.set({
        ...newUserData,
        schemaVersion: SCHEMA_VERSIONS.USER_DOCUMENT, // Set current schema version
      });
    } else {
      // Update existing user document with latest login time and potentially changed info
      const updateData: Partial<UserDocument> = {
        lastLoginAt:
          admin.firestore.FieldValue.serverTimestamp() as unknown as Date,
      };

      // Update email and displayName if they've changed
      const currentData = userDoc.data();
      if (email && currentData?.email !== email) {
        updateData.email = email;
      }
      if (displayName && currentData?.displayName !== displayName) {
        updateData.displayName = displayName;
      }

      // Only update if we have changes to fields other than lastLoginAt
      const updateFields = Object.keys(updateData).filter(
        (key) => key !== "lastLoginAt",
      );
      if (updateFields.length > 0) {
        // There are fields other than lastLoginAt to update
        await userRef.update(updateData);
      } else {
        await userRef.update({
          lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    // Fetch and return the updated user document
    const updatedUserDoc = await userRef.get();
    const userData = updatedUserDoc.data();

    if (!userData) {
      throw new Error(
        `User document not found after ensuring it exists for ${firebaseUid}`,
      );
    }

    // Convert Firestore timestamps to dates for the return type
    return {
      ...userData,
      createdAt: userData.createdAt?.toDate() || new Date(),
      lastLoginAt: userData.lastLoginAt?.toDate() || new Date(),
    } as UserDocument;
  } catch (error) {
    firebaseLogger.error({ error }, "Error ensuring user document");
    throw new Error(
      `Failed to ensure user document for ${firebaseUid}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
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
