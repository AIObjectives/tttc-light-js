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
  // REDIS_HOST: z.string({ required_error: "Missing REDIS_HOST" }),
  // REDIS_PORT: z
  //   .string({ required_error: "Missing REDIS_PORT" })
  //   .refine(
  //     (v) => {
  //       let n = Number(v);
  //       return !isNaN(n) && v?.length > 0;
  //     },
  //     { message: "REDIS_PORT should be a numeric string" },
  //   )
  //   .transform((numstr) => Number(numstr)),
  REDIS_URL: z.string({ required_error: "Missing REDIS_URL" }),
  ALLOWED_GCS_BUCKETS: z.string().transform((val) => val.split(",")),
  REDIS_QUEUE_NAME: z.string().default("pipeline"),
  ALLOWED_ORIGINS: z
    .string({
      required_error: "ALLOWED_ORIGINS is required in all environments",
    })
    .transform((val, ctx) => {
      const origins = val
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);

      // At least one origin should be specified in all environments
      if (origins.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ALLOWED_ORIGINS must contain at least one valid origin",
        });
      }

      // Validate each origin is a valid URL
      const invalidOrigin = origins.find((origin) => {
        try {
          new URL(origin);
          return false;
        } catch {
          return true;
        }
      });
      if (invalidOrigin) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "All ALLOWED_ORIGINS must be valid URLs",
        });
      }

      return origins;
    }),
  // Feature Flag Configuration
  FEATURE_FLAG_PROVIDER: z.enum(["posthog", "local"]).default("local"),
  FEATURE_FLAG_API_KEY: z.string().optional(),
  FEATURE_FLAG_HOST: z.string().optional().default("https://us.i.posthog.com"),
  LOCAL_FLAGS: z
    .string()
    .optional()
    .transform(transformLocalFlags)
    .pipe(
      z
        .record(z.string(), z.union([z.string(), z.boolean(), z.number()]))
        .optional(),
    ),

  // Analytics Configuration
  ANALYTICS_PROVIDER: z.enum(["posthog", "local"]).default("local"),
  ANALYTICS_API_KEY: z.string().optional(),
  ANALYTICS_HOST: z.string().optional().default("https://app.posthog.com"),
  ANALYTICS_FLUSH_AT: z
    .string()
    .optional()
    .default("20")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "ANALYTICS_FLUSH_AT must be a positive number",
    }),
  ANALYTICS_FLUSH_INTERVAL: z
    .string()
    .optional()
    .default("10000")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "ANALYTICS_FLUSH_INTERVAL must be a positive number",
    }),
  ANALYTICS_ENABLED: z
    .string()
    .optional()
    .default("false")
    .transform((val) => val.toLowerCase() === "true"),
  ANALYTICS_DEBUG: z
    .string()
    .optional()
    .default("false")
    .transform((val) => val.toLowerCase() === "true"),
  FIREBASE_ADMIN_PROJECT_ID: z.string().optional(),
  RATE_LIMIT_PREFIX: z.string().optional().default("dev"),

  // Concurrency settings for Python server
  PYSERVER_MAX_CONCURRENCY: z
    .string()
    .optional()
    .default("8") // Match pyserver default
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 20, {
      message: "PYSERVER_MAX_CONCURRENCY must be between 1 and 20",
    }),
});

function transformLocalFlags(val?: string) {
  if (!val || val.trim() === "") return undefined;
  try {
    return JSON.parse(val);
  } catch {
    return undefined;
  }
}

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
