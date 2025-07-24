import { z } from "zod";

export const reportRef = z.object({
  userId: z.string(),
  reportDataUri: z.string().url(),
  title: z.string(),
  description: z.string(),
  numTopics: z.number(),
  numSubtopics: z.number(),
  numClaims: z.number(),
  numPeople: z.number(),
  createdDate: z.preprocess(
    (arg) =>
      firebaseTimestamp.safeParse(arg).success
        ? new Date((arg as FirebaseTimestamp).seconds * 1000)
        : arg,
    z.date(),
  ),
});

export type ReportRef = z.infer<typeof reportRef>;

const firebaseTimestamp = z.object({
  nanoseconds: z.number(),
  seconds: z.number(),
});

type FirebaseTimestamp = z.infer<typeof firebaseTimestamp>;

export const reportJob = z.object({
  userId: z.string(),
  status: z.union([
    z.literal("pending"),
    z.literal("finished"),
    z.literal("failed"),
  ]),
  title: z.string(),
  description: z.string(),
  reportDataUri: z.string().url(),
  // createdAt: z.date(),
  createdAt: z.preprocess(
    (arg) =>
      firebaseTimestamp.safeParse(arg).success
        ? new Date((arg as FirebaseTimestamp).seconds * 1000)
        : arg,
    z.date(),
  ),
});

export type ReportJob = z.infer<typeof reportJob>;

export type JobStatus = ReportJob["status"];

export const userDocument = z.object({
  firebaseUid: z.string(),
  email: z.string().email(),
  // DisplayName is nullable because users may not have set a display name
  displayName: z.string().nullable(),
  isValid: z.boolean(),
  isWaitlistApproved: z.boolean(),
  roles: z.array(z.string()),
  createdAt: z.preprocess(
    (arg) =>
      firebaseTimestamp.safeParse(arg).success
        ? new Date((arg as FirebaseTimestamp).seconds * 1000)
        : arg,
    z.date(),
  ),
  lastLoginAt: z.preprocess(
    (arg) =>
      firebaseTimestamp.safeParse(arg).success
        ? new Date((arg as FirebaseTimestamp).seconds * 1000)
        : arg,
    z.date(),
  ),
});

export type UserDocument = z.infer<typeof userDocument>;

const COLLECTIONS = {
  REPORT_REF: "reportRef",
  REPORT_JOB: "reportJob",
  FEEDBACK: "feedback",
  USERS: "users",
} as const;

export const JOB_STATUS = {
  PENDING: "pending",
  FINISHED: "finished",
  FAILED: "failed",
} as const;

export const useGetCollectionName =
  (NODE_ENV: "development" | "production") =>
  (name: keyof typeof COLLECTIONS) => {
    return NODE_ENV === "production"
      ? COLLECTIONS[name]
      : `${COLLECTIONS[name]}_dev`;
  };
