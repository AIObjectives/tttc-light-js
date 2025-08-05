import * as admin from "firebase-admin";
import { Env, validateEnv } from "./types/context";
import {
  ReportJob,
  ReportRef,
  JobStatus,
  useGetCollectionName,
  JOB_STATUS,
  UserDocument,
} from "tttc-common/firebase";
import { logger } from "tttc-common/logger";

const env: Env = validateEnv();

console.log(
  "[UserAccount] STARTUP: Environment validation successful, initializing Firebase...",
);

const FIREBASE_CREDENTIALS = JSON.parse(
  Buffer.from(env.FIREBASE_CREDENTIALS_ENCODED!, "base64").toString("utf-8"),
);

console.log(
  "[UserAccount] STARTUP: Firebase credentials parsed, creating admin app...",
);

const app = admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_CREDENTIALS),
});

console.log(
  "[UserAccount] STARTUP: Firebase admin app initialized successfully",
);

const db = admin.firestore(app);

const auth = admin.auth(app);

const getCollectionName = useGetCollectionName(env.NODE_ENV);

// Export for use in other routes
export { db, admin, getCollectionName };

console.log(
  "[UserAccount] STARTUP: express Firebase.ts module loaded, NODE_ENV:",
  env.NODE_ENV,
);

/**
 * Creates a reportRef (basic summary of a report to preview) and returns an id
 *
 * For arg id, make sure its the same id as the job so we can easily establish a one-to-one relationship
 */
export async function addReportRef(id: string, reportRef: ReportRef) {
  const docRef = db.collection(getCollectionName("REPORT_REF")).doc(id);

  await docRef.set({
    ...reportRef,
    createdDate: admin.firestore.Timestamp.fromDate(reportRef.createdDate),
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
    // propogate job not found error
    if (e instanceof JobNotFoundError) {
      throw new JobNotFoundError(e.message);
    }
    const message = e instanceof Error ? e.message : e?.toString();
    throw new Error(`Failed to update job status: ${message}`);
  }
}

export async function verifyUser(token: string) {
  return await auth.verifyIdToken(token);
}

export async function ensureUserDocument(
  firebaseUid: string,
  email: string | null = null,
  displayName: string | null = null,
) {
  logger.debug("ensureUserDocument called", {
    firebaseUid,
    email,
    displayName,
  });
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
        isWaitlistApproved: true, // User is not waiting to be approved on the waitlist.
        roles: ["user"],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await userRef.set(newUserData);
    } else {
      // Update existing user document with latest login time and potentially changed info
      const updateData: Partial<UserDocument> = {
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp() as any,
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
  } catch (error) {
    logger.error("Error ensuring user document", error);
    throw new Error(
      `Failed to ensure user document for ${firebaseUid}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
