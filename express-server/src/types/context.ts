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
  // Basic URL validation - additional HTTPS check for prod will be done in validateEnv
  CLIENT_BASE_URL: z.string()
    .refine(
      (url) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      },
      {message: "CLIENT_BASE_URL must be a valid URL"}
    ),
  // Basic URL validation - additional HTTPS check for prod will be done in validateEnv
  PYSERVER_URL: z.string()
    .refine(
      (url) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      },
      {message: "PYSERVER_URL must be a valid URL"}
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
  REDIS_URL: z.string({ required_error: "Missing REDIS_URL" }),
});

export type Env = z.infer<typeof env>;

/**
 * Parse Env and perform additional validation
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

  const validatedEnv = parsed.data;
  const errors: string[] = [];

  // Additional validation for production environment
  if (validatedEnv.NODE_ENV === "prod") {
    // Check that URLs use HTTPS in production
    if (!validatedEnv.CLIENT_BASE_URL.startsWith("https://")) {
      errors.push("CLIENT_BASE_URL must use HTTPS in production");
    }
    
    if (!validatedEnv.PYSERVER_URL.startsWith("https://")) {
      errors.push("PYSERVER_URL must use HTTPS in production");
    }
  }

  // Throw error if there are any validation failures
  if (errors.length > 0) {
    throw new EnvValidationError(
      `❌ Additional environment validation failed: \n\n${errors
        .map((e, i) => {
          return `${i}) ${e} \n`;
        })
        .join("")}`
    );
  }

  return validatedEnv;
}
