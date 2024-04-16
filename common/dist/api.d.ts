import { z } from "zod";
export declare const generateApiReponse: z.ZodObject<
  {
    message: z.ZodString;
    filename: z.ZodString;
    jsonUrl: z.ZodString;
    reportUrl: z.ZodString;
  },
  "strip",
  z.ZodTypeAny,
  {
    message?: string;
    filename?: string;
    jsonUrl?: string;
    reportUrl?: string;
  },
  {
    message?: string;
    filename?: string;
    jsonUrl?: string;
    reportUrl?: string;
  }
>;
export type GenerateApiResponse = z.infer<typeof generateApiReponse>;
