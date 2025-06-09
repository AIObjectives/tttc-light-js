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

/**
 * Custom error class since we don't really need a stack trace
 */
class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.stack = "";
    this.name = "";
  }
}

export const env = z.object({
  OPENAI_API_KEY: z.string({ required_error: "Missing OpenAI Key" }),
  OPENAI_API_KEY_PASSWORD: z
    .string({ invalid_type_error: "Invalid type for openapi key password" })
    .optional(),
  GCLOUD_STORAGE_BUCKET: z.string({
    required_error: "Missing GCloud storage bucket",
  }),
  GOOGLE_CREDENTIALS_ENCODED: z.string({
    required_error: "Missing encoded GCloud credentials",
  }),
  FIREBASE_CREDENTIALS_ENCODED: z.string({
    required_error: "Missing encoded Firebase credentials",
  }),
  CLIENT_BASE_URL: z
    .string({ required_error: "Missing CLIENT_BASE_URL" })
    .url({ message: "PYSERVER_URL in env should be a valid url" }),
  PYSERVER_URL: z
    .string({ required_error: "Missing PYSERVER_URL" })
    .url({ message: "PYSERVER_URL in env should be a valid url" }),
  NODE_ENV: z.union([z.literal("development"), z.literal("production")], {
    required_error: "Missing NODE_ENV (production | development)",
    invalid_type_error: "Invalid input for NODE_ENV",
  }),
  FIREBASE_DATABASE_URL: z
    .string({ required_error: "Missing FIREBASE_DATABASE_URL" })
    .url({ message: "FIREBASE_DATABASE_URL in env should be a valid url" }),
  // REDIS_HOST: z.string({ required_error: "Missing REDIS_HOST" }),
  // REDIS_PORT: z
  //   .string({ required_error: "Missing REDIS_PORT" })
  //   .refine(
  //     (v) => {
  //       let n = Number(v);
  //       return !isNaN(n) && v?.length > 0;
  //     },
  //     { message: "REDIS_PORT should be a numberic string" },
  //   )
  //   .transform((numstr) => Number(numstr)),
  REDIS_URL: z.string({ required_error: "Missing REDIS_URL" }),
  ALLOWED_GCS_BUCKETS: z.string().transform((val) => val.split(",")),
});

export type Env = z.infer<typeof env>;

/**
 * Parse Env
 */
export function validateEnv(): Env {
  const parsed = env.safeParse(process.env);
  if (parsed.success === false) {
    throw new EnvValidationError(
      `❌ Invalid environment variables: \n\n${parsed.error.errors
        .map((e, i) => {
          return `${i}) ${e.message} \n`;
        })
        .join("")}`,
    );
  }

  return parsed.data;
}
