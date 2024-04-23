import { z } from "zod";
import * as schema from "./schema";

export const generateApiRequest = z.object({
  userConfig: schema.userConfig,
  dataPayload: schema.dataPayload,
});

export type GenerateApiRequest = z.infer<typeof generateApiRequest>;

export const generateApiReponse = z.object({
  message: z.string(),
  filename: z.string().min(1),
  jsonUrl: z.string().url(),
  reportUrl: z.string().url(),
});

export type GenerateApiResponse = z.infer<typeof generateApiReponse>;
