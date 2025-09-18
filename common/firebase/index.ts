import { z } from "zod";

// Schema for report data URIs that allows placeholder values during processing
const reportDataUriSchema = z.union([
  z.literal("about:blank"),
  z.string().url(),
]);

// Report status enum - single source of truth for report state
const reportStatus = z.enum([
  "created", // Initial state, job not yet queued
  "queued", // Job queued but not started
  "processing", // Job is actively running (with sub-states)
  "completed", // Job finished successfully, data available
  "failed", // Job failed permanently
  "cancelled", // Job was cancelled
]);

export type ReportStatus = z.infer<typeof reportStatus>;
export { reportStatus };

// Processing sub-states for detailed progress tracking
const processingSubState = z
  .enum([
    "clustering",
    "extraction",
    "sorting",
    "dedup",
    "wrappingup",
    "summarizing",
  ])
  .nullish();

// Schema for report references in Firestore
const reportRefSchema = z.object({
  id: z.string(), // Document ID from Firestore (stable report ID)
  userId: z.string(),
  reportDataUri: reportDataUriSchema,
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
  // Job ID for the job that generated this report
  jobId: z.string().optional(),
  // Schema version for broader migration support
  schemaVersion: z.number().optional(), // Incremental schema version for future migrations

  // AUTHORITATIVE STATUS FIELDS - Optional for backward compatibility
  status: reportStatus.optional(),
  processingSubState: processingSubState,
  lastStatusUpdate: z
    .preprocess(
      (arg) =>
        firebaseTimestamp.safeParse(arg).success
          ? new Date((arg as FirebaseTimestamp).seconds * 1000)
          : arg,
      z.date(),
    )
    .optional(),
  errorMessage: z.string().optional(), // Details when status is "failed"
});

export const reportRef = reportRefSchema;

// Schema with defaults for parsing potentially incomplete documents
export const reportRefWithDefaults = reportRefSchema.extend({
  title: z.string().default("Untitled Report"),
  description: z.string().default("Report processing failed"),
  numTopics: z.number().default(0),
  numSubtopics: z.number().default(0),
  numClaims: z.number().default(0),
  numPeople: z.number().default(0),
});

export type ReportRef = z.infer<typeof reportRef>;

const firebaseTimestamp = z.object({
  nanoseconds: z.number(),
  seconds: z.number(),
});

type FirebaseTimestamp = z.infer<typeof firebaseTimestamp>;

export const reportJob = z.object({
  userId: z.string(),
  title: z.string(),
  description: z.string(),
  reportDataUri: z.string().url(),
  createdAt: z.preprocess(
    (arg) =>
      firebaseTimestamp.safeParse(arg).success
        ? new Date((arg as FirebaseTimestamp).seconds * 1000)
        : arg,
    z.date(),
  ),
  // Schema version for future migrations
  schemaVersion: z.number().optional(),
});

export type ReportJob = z.infer<typeof reportJob>;

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
  // Schema version for future migrations
  schemaVersion: z.number().optional(),
});

export type UserDocument = z.infer<typeof userDocument>;

const COLLECTIONS = {
  REPORT_REF: "reportRef",
  REPORT_JOB: "reportJob",
  FEEDBACK: "feedback",
  USERS: "users",
} as const;

/**
 * Current schema versions for different document types
 * Increment these when making breaking schema changes
 */
export const SCHEMA_VERSIONS = {
  REPORT_REF: 1, // Current schema with placeholder URI security
  REPORT_JOB: 1, // Current schema with timestamps and optional fields
  USER_DOCUMENT: 1, // Current schema with roles and waitlist support
} as const;

export const useGetCollectionName =
  (NODE_ENV: "development" | "production") =>
  (name: keyof typeof COLLECTIONS) => {
    return NODE_ENV === "production"
      ? COLLECTIONS[name]
      : `${COLLECTIONS[name]}_dev`;
  };
