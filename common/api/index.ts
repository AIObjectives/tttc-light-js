import { z } from "zod";
import { elicitationEventSummary } from "../firebase";
import * as schema from "../schema";

export const generateApiRequest = z.object({
  userConfig: schema.llmUserConfig,
  data: schema.dataPayload,
  elicitationEventId: z.string().optional(),
});

export type GenerateApiRequest = z.infer<typeof generateApiRequest>;

export const generateApiResponse = z.object({
  message: z.string(),
  filename: z.string().min(1),
  jsonUrl: z.string().url(),
  reportUrl: z.string().url(),
});

export type GenerateApiResponse = z.infer<typeof generateApiResponse>;

export const reportJobStatus = z.enum([
  "queued",
  "clustering",
  "extraction",
  "sorting",
  "dedup",
  "summarizing",
  "wrappingup",
  "scoring_bridging",
  "finished",
  "failed",
  "notFound",
]);

export type ReportJobStatus = z.infer<typeof reportJobStatus>;

export const getReportRequestUri = z.string();

export const getReportResponse = z.object({
  status: z.string(),
});

export const migrationApiResponse = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    newUrl: z.string(),
    docId: z.string(),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
  }),
]);

export type MigrationApiResponse = z.infer<typeof migrationApiResponse>;

export const userCapabilitiesResponse = z.object({
  csvSizeLimit: z.number().min(0),
  canViewElicitationTracking: z.boolean(),
  // Future capabilities can be added here
});

export type UserCapabilitiesResponse = z.infer<typeof userCapabilitiesResponse>;

// Form action result types for Next.js server actions
export const formActionError = z.object({
  code: z.string(),
  message: z.string(),
  /** Unique request ID for correlating with server logs */
  requestId: z.string().optional(),
});

export type FormActionError = z.infer<typeof formActionError>;

export type CreateReportActionResult =
  | { status: "idle" }
  | { status: "success"; data: GenerateApiResponse }
  | { status: "error"; error: FormActionError };

// GET /api/elicitation/events response
export const elicitationEventsResponse = z.object({
  events: z.array(elicitationEventSummary),
});

export type ElicitationEventsResponse = z.infer<
  typeof elicitationEventsResponse
>;

// GET /api/elicitation/events/:id response
export const elicitationEventResponse = z.object({
  event: elicitationEventSummary,
});

export type ElicitationEventResponse = z.infer<typeof elicitationEventResponse>;

// POST /api/elicitation/events request
export const createElicitationEventRequest = z.object({
  eventName: z.string(),
  description: z.string().optional(),
  startDate: z.string().optional(), // ISO date string
  endDate: z.string().optional(), // ISO date string
  mode: z.enum(["followup", "listener", "survey"]),
  mainQuestion: z.string().optional(),
  questions: z.array(z.string()).optional(),
  followUpQuestions: z.array(z.string()).optional(),
  initialMessage: z.string().optional(),
  completionMessage: z.string().optional(),
  expectedParticipantCount: z.number().optional(),
});

export type CreateElicitationEventRequest = z.infer<
  typeof createElicitationEventRequest
>;

// POST /api/elicitation/events response
export const createElicitationEventResponse = z.object({
  event: elicitationEventSummary,
});

export type CreateElicitationEventResponse = z.infer<
  typeof createElicitationEventResponse
>;

// PATCH /api/elicitation/events/:id request
export const updateElicitationEventRequest = z.object({
  eventName: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().optional(), // ISO date string
  endDate: z.string().optional(), // ISO date string
  mode: z.enum(["followup", "listener", "survey"]).optional(),
  mainQuestion: z.string().optional(),
  questions: z.array(z.string()).optional(),
  followUpQuestions: z.array(z.string()).optional(),
  initialMessage: z.string().optional(),
  completionMessage: z.string().optional(),
  expectedParticipantCount: z.number().optional(),
});

export type UpdateElicitationEventRequest = z.infer<
  typeof updateElicitationEventRequest
>;
