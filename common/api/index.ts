import { z } from "zod";
import * as schema from "../schema";

export const generateApiRequest = z.object({
  userConfig: schema.llmUserConfig,
  data: schema.dataPayload,
  firebaseAuthToken: z.string().nullable(),
});

export type GenerateApiRequest = z.infer<typeof generateApiRequest>;

export const generateApiReponse = z.object({
  message: z.string(),
  filename: z.string().min(1),
  jsonUrl: z.string().url(),
  reportUrl: z.string().url(),
});

export type GenerateApiResponse = z.infer<typeof generateApiReponse>;

export const reportJobStatus = z.enum([
  "queued",
  "clustering",
  "extraction",
  "sorting",
  "dedup",
  "wrappingup",
  "finished",
  "failed",
  "notFound",
]);

export type ReportJobStatus = z.infer<typeof reportJobStatus>;

export const getReportRequestUri = z.string();

export const getReportResponse = z.object({
  status: z.string(),
});
