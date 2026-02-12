import { z } from "zod";

/**
 * Branded type for Report IDs (Firebase document IDs).
 * Provides type safety to distinguish report IDs from other string parameters.
 */
export type ReportId = string & { readonly __brand: "ReportId" };

/**
 * Type guard to create a ReportId from a validated string.
 * Use after validating the string is a valid Firebase document ID.
 */
export function asReportId(id: string): ReportId {
  return id as ReportId;
}

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

// Export ProcessingSubState type for use in status mapping
export type ProcessingSubState = z.infer<typeof processingSubState>;

// Processing sub-states for detailed progress tracking
const processingSubState = z
  .enum([
    "clustering",
    "extraction",
    "sorting",
    "dedup",
    "wrappingup",
    "summarizing",
    "scoring_bridging",
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

  // Language the report was generated in (for T3C-616 translation feature compatibility)
  outputLanguage: z.string().optional(), // Default: "English" if not set
  // Visibility: undefined = legacy (public), true = public, false = private
  // New reports default to private. Existing reports without this field are grandfathered as public.
  isPublic: z.boolean().optional(),
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
  outputLanguage: z.string().default("English"),
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
  isWaitlistApproved: z.boolean().optional(), // Legacy field, no longer set for new users
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
  // Profile fields for progressive profiling (monday.com CRM integration)
  company: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  useCase: z.string().optional(),
  newsletterOptIn: z.boolean().optional(),
  profileCompletedAt: z
    .preprocess(
      (arg) =>
        firebaseTimestamp.safeParse(arg).success
          ? new Date((arg as FirebaseTimestamp).seconds * 1000)
          : arg,
      z.date(),
    )
    .optional(),
  // Schema version for future migrations
  schemaVersion: z.number().optional(),
});

export type UserDocument = z.infer<typeof userDocument>;

// Elicitation event status enum
const elicitationEventStatus = z.enum([
  "draft", // Event created but not yet started
  "active", // Event is currently running
  "completed", // Event has finished
  "archived", // Event is archived
]);

export type ElicitationEventStatus = z.infer<typeof elicitationEventStatus>;
export { elicitationEventStatus };

// Elicitation event summary for tracking page
export const elicitationEventSummary = z.object({
  id: z.string(), // Event document ID
  eventName: z.string(), // Human-readable event name
  description: z.string().optional(), // Full description of the study/event
  ownerUserId: z.string(), // Firebase UID of owner
  responderCount: z.number(), // Count of participants
  createdAt: z.preprocess(
    (arg) =>
      firebaseTimestamp.safeParse(arg).success
        ? new Date((arg as FirebaseTimestamp).seconds * 1000)
        : arg,
    z.date(),
  ),
  // Event date range
  startDate: z
    .preprocess(
      (arg) =>
        firebaseTimestamp.safeParse(arg).success
          ? new Date((arg as FirebaseTimestamp).seconds * 1000)
          : arg,
      z.date(),
    )
    .optional(),
  endDate: z
    .preprocess(
      (arg) =>
        firebaseTimestamp.safeParse(arg).success
          ? new Date((arg as FirebaseTimestamp).seconds * 1000)
          : arg,
      z.date(),
    )
    .optional(),
  // Event status
  status: elicitationEventStatus.optional(),
  // Event mode (required)
  mode: z.enum(["followup", "listener", "survey"]),
  // WhatsApp link for participants
  whatsappLink: z.string().optional(),
  // Event questions (optional - may not exist on all events)
  mainQuestion: z.string().optional(), // Primary survey question
  questions: z.array(z.string()).optional(), // Array of question strings
  followUpQuestions: z.array(z.string()).optional(), // Array of follow-up question strings
  initialMessage: z.string().optional(), // Opening/welcome message
  completionMessage: z.string().optional(), // Closing message
  // Link to generated report (if available)
  reportId: z.string().optional(),
  // Schema version for future migrations
  schemaVersion: z.number().optional(),
});

export type ElicitationEventSummary = z.infer<typeof elicitationEventSummary>;

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
  USER_DOCUMENT: 1, // Current schema with roles and profile fields
  ELICITATION_EVENT: 1, // Current schema with description, dates, status, whatsapp link
} as const;

export const useGetCollectionName =
  (NODE_ENV: "development" | "production" | "test") =>
  (name: keyof typeof COLLECTIONS) => {
    return NODE_ENV === "production"
      ? COLLECTIONS[name]
      : `${COLLECTIONS[name]}_dev`;
  };
