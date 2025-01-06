import { z } from "zod";
import * as admin from "firebase-admin";
import { Env, validateEnv } from "./types/context";
import { applicationDefault } from "firebase-admin/app";

const env: Env = validateEnv();

const app = admin.initializeApp({
  credential: applicationDefault(),
  databaseURL: env.FIREBASE_DATABASE_URL,
});

const db = admin.firestore(app);

const auth = admin.auth(app);

const reportRef = z.object({
  userId: z.string(),
  reportUrl: z.string().url(),
  title: z.string(),
  description: z.string(),
  numTopics: z.number(),
  numSubtopics: z.number(),
  numClaims: z.number(),
  numPeople: z.number(),
  createdDate: z.date(),
});

type ReportRef = z.infer<typeof reportRef>;

const reportJob = z.object({
  userId: z.string(),
  status: z.union([
    z.literal("pending"),
    z.literal("finished"),
    z.literal("failed"),
  ]),
  title: z.string(),
  description: z.string(),
});

type ReportJob = z.infer<typeof reportJob>;

type JobStatus = ReportJob["status"];

const COLLECTIONS = {
  REPORT_REF: "reportRef",
  REPORT_JOB: "reportJob",
} as const;

const JOB_STATUS = {
  PENDING: "pending",
  FINISHED: "finished",
  FAILED: "failed",
} as const;

const getCollectionName = (name: keyof typeof COLLECTIONS) => {
  return env.NODE_ENV === "prod"
    ? COLLECTIONS[name]
    : `${COLLECTIONS[name]}_dev`;
};

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
export async function addReportJob(jobDetails: {
  userId: string;
  title: string;
  description: string;
  reportUrl: string;
}) {
  const docRef = db.collection(getCollectionName("REPORT_JOB")).doc();

  await docRef.set({
    ...jobDetails,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    status: JOB_STATUS.PENDING,
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
    throw new Error(`Failed to update job status: ${e.message}`);
  }
}

export async function verifyUser(token: string) {
  return await auth.verifyIdToken(token);
}

// Note: Might actually want to implement this with Firestore front-end client
// async getUsersReports(userId:string) {
//     return await this.db.collection(this.getCollectionName('reportRef'))
//         .where('userId', '==', userId)
//         .orderBy("createdDate", 'desc')
//         .get()
//         .then((res) => res.docs)
//         .then((docs) => ({tag:'success', data:reportRef.array().parse(docs)}))
//         .catch((reason) => ({tag:'failed',reason:`Query Failed: ${JSON.stringify(reason)}`}))
// }
// }
