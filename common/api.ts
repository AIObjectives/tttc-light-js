import { z } from "zod";

export const generateApiReponse = z.object({
  message: z.string(),
  filename: z.string().min(1),
  jsonUrl: z.string().url(),
  reportUrl: z.string().url(),
});

export type GenerateApiResponse = z.infer<typeof generateApiReponse>;
