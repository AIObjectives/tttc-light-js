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
    this.name = "EnvValidationError";
  }
}

/**
 * Environment type for validation
 */
export type Environment = "dev" | "prod";

/**
 * Environment configuration options
 */
export type EnvConfig = {
  /**
   * Whether to enforce HTTPS URLs in validation
   * @default false
   */
  requireHttps?: boolean;
};

/**
 * Creates a URL validator with configurable HTTPS requirement
 * @param fieldName - Name of the URL field for error messages
 * @param config - Environment configuration options
 */
export const createUrlValidator = (fieldName: string, config: EnvConfig = {}) => {
  return z.string()
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          if (config.requireHttps && !parsed.protocol.startsWith("https")) {
            return false;
          }
          return true;
        } catch {
          return false;
        }
      },
      {
        message: config.requireHttps
          ? `${fieldName} must be a valid HTTPS URL`
          : `${fieldName} must be a valid URL`,
      },
    );
};

/**
 * Creates a port number validator
 * @param fieldName - Name of the port field for error messages
 */
export const createPortValidator = (fieldName: string) => {
  return z.string()
    .refine(
      (v) => {
        const n = Number(v);
        return !isNaN(n) && v?.length > 0;
      },
      { message: `${fieldName} should be a numeric string` },
    )
    .transform((numstr) => Number(numstr));
};

/**
 * Validates environment type
 */
export const validateEnvironment = (env: string | undefined): Environment => {
  if (!env || !["dev", "prod"].includes(env.toLowerCase())) {
    throw new Error("Environment not set: NODE_ENV must be 'dev' or 'prod'");
  }
  return env.toLowerCase() as Environment;
};

/**
 * Environment variable validation schema
 * 
 * Development:
 * - URLs can be HTTP or HTTPS
 * - Redis can use either REDIS_HOST + REDIS_PORT or REDIS_URL
 * 
 * Production:
 * - All URLs must be HTTPS
 * - Redis configuration same as development
 */
export const env = z.object({
  OPENAI_API_KEY: z.string({ required_error: "Missing OpenAI Key" }),
  GCLOUD_STORAGE_BUCKET: z.string({
    required_error: "Missing GCloud storage bucket",
  }),
  GOOGLE_CREDENTIALS_ENCODED: z.string({
    required_error: "Missing encoded GCloud credentials",
  }),
  CLIENT_BASE_URL: createUrlValidator("CLIENT_BASE_URL"),
  PYSERVER_URL: createUrlValidator("PYSERVER_URL"),
  NODE_ENV: z.union([z.literal("dev"), z.literal("prod")], {
    required_error: "Missing NODE_ENV (prod | dev)",
    invalid_type_error: "Invalid input for NODE_ENV",
  }),
  FIREBASE_PROJECT_ID: z.string({
    required_error: "Missing FIREBASE_PROJECT_ID",
  }),
  FIREBASE_DATABASE_URL: createUrlValidator("FIREBASE_DATABASE_URL"),
  REDIS_HOST: z.string({ required_error: "Missing REDIS_HOST" }),
  REDIS_PORT: createPortValidator("REDIS_PORT"),
  REDIS_URL: z.string({ required_error: "Missing REDIS_URL" }),
});

export type Env = z.infer<typeof env>;

/**
 * Parse and validate environment variables
 * 
 * Validates:
 * 1. Required environment variables are present
 * 2. URLs are properly formatted
 * 3. Port numbers are valid
 * 4. In production, enforces HTTPS for all URLs
 */
export function validateEnv(): Env {
  const parsed = env.safeParse(process.env);

  if (!parsed.success) {
    throw new EnvValidationError(
      `❌ Invalid environment variables: \n\n${parsed.error.errors
        .map((e, i) => {
          return `${i}) [${e.path}]: ${e.message} \n`;
        })
        .join("")}`
    );
  }

  const validatedEnv = parsed.data;
  const environment = validateEnvironment(validatedEnv.NODE_ENV);
  const errors: string[] = [];

  // Additional validation for production environment
  if (environment === "prod") {
    // Validate HTTPS URLs
    const urlFields = {
      CLIENT_BASE_URL: validatedEnv.CLIENT_BASE_URL,
      PYSERVER_URL: validatedEnv.PYSERVER_URL,
      FIREBASE_DATABASE_URL: validatedEnv.FIREBASE_DATABASE_URL,
    };

    Object.entries(urlFields).forEach(([field, url]) => {
      if (!url.startsWith("https://")) {
        errors.push(`${field} must use HTTPS in production`);
      }
    });
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
