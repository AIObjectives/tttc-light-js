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

/**
 * Flag value schema with helpful error message.
 * Only primitive types (string, boolean, number) are supported.
 */
const flagValueSchema = z.union([z.string(), z.boolean(), z.number()], {
  message:
    "LOCAL_FLAGS values must be primitives (string, boolean, or number). Arrays, objects, and null are not supported.",
});

/**
 * Transform and validate LOCAL_FLAGS JSON string.
 * Returns parsed object if valid, undefined if empty/not set.
 * Throws descriptive error if JSON is invalid.
 */
function transformLocalFlags(
  val: string | undefined,
  ctx: z.RefinementCtx,
): Record<string, unknown> | undefined {
  if (!val || val.trim() === "") return undefined;

  try {
    const parsed = JSON.parse(val);

    // Ensure it's an object (not array, null, or primitive)
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "LOCAL_FLAGS must be a JSON object (e.g., '{\"flag\": true}'). Got: " +
          (parsed === null
            ? "null"
            : Array.isArray(parsed)
              ? "array"
              : typeof parsed),
      });
      return z.NEVER;
    }

    return parsed;
  } catch (e) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `LOCAL_FLAGS contains invalid JSON: ${e instanceof Error ? e.message : "parse error"}. Ensure proper quoting: LOCAL_FLAGS='{"flag": true}'`,
    });
    return z.NEVER;
  }
}

export const env = z.object({
  OPENAI_API_KEY: z.string({ error: "Missing OpenAI Key" }),
  OPENAI_API_KEY_PASSWORD: z
    .string({ error: "Invalid type for openapi key password" })
    .optional(),
  GCLOUD_STORAGE_BUCKET: z.string({
    error: "Missing GCloud storage bucket",
  }),
  GOOGLE_CREDENTIALS_ENCODED: z.string({
    error: "Missing encoded GCloud credentials",
  }),
  FIREBASE_CREDENTIALS_ENCODED: z.string({
    error: "Missing encoded Firebase credentials",
  }),
  CLIENT_BASE_URL: z
    .string({ error: "Missing CLIENT_BASE_URL" })
    .url({ message: "PYSERVER_URL in env should be a valid url" }),
  PYSERVER_URL: z
    .string({ error: "Missing PYSERVER_URL" })
    .url({ message: "PYSERVER_URL in env should be a valid url" }),
  NODE_ENV: z.union(
    [z.literal("development"), z.literal("production"), z.literal("test")],
    {
      error: "Missing or invalid NODE_ENV (production | development | test)",
    },
  ),
  REDIS_URL: z.string({ error: "Missing REDIS_URL" }),
  ALLOWED_GCS_BUCKETS: z.string().transform((val) => val.split(",")),
  REDIS_QUEUE_NAME: z.string().default("pipeline"),
  // Queue system configuration (optional in test environment)
  PUBSUB_TOPIC_NAME: z.string().optional().default("test-topic"),
  PUBSUB_SUBSCRIPTION_NAME: z.string().optional().default("test-subscription"),
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
  ALLOWED_ORIGINS: z
    .string({
      error: "ALLOWED_ORIGINS is required in all environments",
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
    .pipe(z.record(z.string(), flagValueSchema).optional()),

  // Analytics Configuration
  ANALYTICS_PROVIDER: z.enum(["posthog", "local"]).default("local"),
  ANALYTICS_API_KEY: z.string().optional(),
  ANALYTICS_HOST: z.string().optional().default("https://app.posthog.com"),
  ANALYTICS_FLUSH_AT: z
    .string()
    .optional()
    .default("20")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !Number.isNaN(val) && val > 0, {
      message: "ANALYTICS_FLUSH_AT must be a positive number",
    }),
  ANALYTICS_FLUSH_INTERVAL: z
    .string()
    .optional()
    .default("10000")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !Number.isNaN(val) && val > 0, {
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
    .refine((val) => !Number.isNaN(val) && val > 0 && val <= 20, {
      message: "PYSERVER_MAX_CONCURRENCY must be between 1 and 20",
    }),
});

export type Env = z.infer<typeof env>;

/**
 * Parse Env
 */
export function validateEnv(): Env {
  const parsed = env.safeParse(process.env);
  if (parsed.success === false) {
    throw new EnvValidationError(
      `❌ Invalid environment variables: \n\n${parsed.error.issues
        .map((e, i) => {
          return `${i}) ${e.message} \n`;
        })
        .join("")}`,
    );
  }

  return parsed.data;
}
