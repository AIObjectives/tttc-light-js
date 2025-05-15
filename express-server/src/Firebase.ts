import * as admin from "firebase-admin";
import { Env, validateEnv } from "./types/context";
import {
  ReportJob,
  ReportRef,
  JobStatus,
  useGetCollectionName,
  JOB_STATUS,
} from "tttc-common/firebase";

const env: Env = validateEnv();

const FIREBASE_CREDENTIALS = JSON.parse(
  Buffer.from(env.FIREBASE_CREDENTIALS_ENCODED!, "base64").toString("utf-8"),
);

const app = admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_CREDENTIALS),
  databaseURL: env.FIREBASE_DATABASE_URL,
});

const db = admin.firestore(app);

const auth = admin.auth(app);

const getCollectionName = useGetCollectionName(env.NODE_ENV);

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
