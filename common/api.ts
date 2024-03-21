import { z } from "zod";

/**
 * /GENERATE
 */

// make generateApiRequest if we need to change requst body to include more than options

export const generateApiReponse = z.object({
  message: z.string(),
  filename: z.string(),
  url: z.string(),
});

export type GenerateApiResponse = z.infer<typeof generateApiReponse>;
