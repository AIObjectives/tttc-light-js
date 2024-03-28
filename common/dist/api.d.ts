import { z } from "zod";
/**
 * /GENERATE
 */
export declare const generateApiReponse: z.ZodObject<{
    message: z.ZodString;
    filename: z.ZodString;
    url: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message?: string;
    filename?: string;
    url?: string;
}, {
    message?: string;
    filename?: string;
    url?: string;
}>;
export type GenerateApiResponse = z.infer<typeof generateApiReponse>;
