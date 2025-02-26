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
  GCLOUD_STORAGE_BUCKET: z.string({
    required_error: "Missing GCloud storage bucket",
  }),
  GOOGLE_CREDENTIALS_ENCODED: z.string({
    required_error: "Missing encoded GCloud credentials",
  }),
  CLIENT_BASE_URL: z.string()
    .refine(
      (url) => {
        try {
          new URL(url);
          const isProd = process.env.NODE_ENV === "prod";
          if (isProd && !url.startsWith("https://")) {
            return false;
          }
          return true;
        } catch {
          return false;
        }
      },
      {
        message: (val) => 
          process.env.NODE_ENV === "prod" 
            ? "CLIENT_BASE_URL must be a valid HTTPS URL in production" 
            : "CLIENT_BASE_URL must be a valid URL"
      }
    ),
  PYSERVER_URL: z.string()
    .refine(
      (url) => {
        try {
          new URL(url);
          const isProd = process.env.NODE_ENV === "prod";
          if (isProd && !url.startsWith("https://")) {
            return false;
          }
          return true;
        } catch {
          return false;
        }
      },
      {
        message: (val) => 
          process.env.NODE_ENV === "prod" 
            ? "PYSERVER_URL must be a valid HTTPS URL in production" 
            : "PYSERVER_URL must be a valid URL"
      }
    ),
  NODE_ENV: z.union([z.literal("dev"), z.literal("prod")], {
    required_error: "Missing NODE_ENV (prod | dev)",
    invalid_type_error: "Invalid input for NODE_ENV",
  }),
  GOOGLE_APPLICATION_CREDENTIALS: z.string({
    required_error:
      "Missing GOOGLE_APPLICATION_CREDENTIALS from env. This is a path to your credentials json.",
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
