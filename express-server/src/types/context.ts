import "dotenv/config";
import { z } from "zod";

declare global {
  namespace Express {
    interface Request {
      context: {
        env: Env;
      };
    }
  }
}

export const env = z.object({
  OPENAI_API_KEY: z.string({ required_error: "Missing OpenAI Key" }),
  OPENAI_API_KEY_PASSWORD: z.string().optional(),
  GCLOUD_STORAGE_BUCKET: z.string({
    required_error: "Missing GCloud storage bucket",
  }),
  GOOGLE_CREDENTIALS_ENCODED: z.string({
    required_error: "Missing encoded GCloud credentials",
  }),
  CLIENT_BASE_URL: z
    .string({ required_error: "Missing Client Url" })
    .url("Invalid URL"),
  PYSERVER_URL: z
    .string({ required_error: "Missing Pyserver Url" })
    .url("Invalid URL"),
});

export type Env = z.infer<typeof env>;

/**
 * Parse Env
 */
export function validateEnv(): Env {
  const parsed = env.safeParse(process.env);
  if (parsed.success === false) {
    console.error("❌ Invalid environment variables:", parsed.error.toString());
    process.exit(1);
  }

  return parsed.data;
}
