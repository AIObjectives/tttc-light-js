import { z } from "zod";
import * as schema from "../schema";

export const generateApiRequest = z.object({
  userConfig: schema.llmUserConfig,
  data: schema.dataPayload,
  firebaseAuthToken: z.string().nullable(),
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
