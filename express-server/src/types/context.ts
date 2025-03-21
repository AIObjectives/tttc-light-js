import "dotenv/config";
import { z } from "zod";
import { 
  EnvValidationError, 
  requiresHttps,
  validateEnvironment
} from "tttc-common/environmentValidation";

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
 * Environment validation schema
 */
export const env = z.object({
  OPENAI_API_KEY: z.string(),
  GCLOUD_STORAGE_BUCKET: z.string(),
  FIREBASE_DATABASE_URL: z.string(),
  FIREBASE_PROJECT_ID: z.string(),
  CLIENT_BASE_URL: z.string(),
  PYSERVER_URL: z.string(),
  GOOGLE_CREDENTIALS_ENCODED: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  REDIS_HOST: z.string(),
  REDIS_PORT: z.string(),
  REDIS_URL: z.string(),
  NODE_ENV: z.string(),
});

export type Env = z.infer<typeof env>;

/**
 * Parse and validate environment variables
 * 
 * Validates:
 * 1. Required environment variables are present
 * 2. URLs are properly formatted
 * 3. Port numbers are valid
 * 4. In production and staging, enforces HTTPS for all URLs
 */
export function validateEnv(): Env {
  const parsed = env.safeParse(process.env);

  if (parsed.success === false) {
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

  // Additional validation for production and staging environments
  if (requiresHttps(environment)) {
    // Validate HTTPS URLs
    const urlFields = {
      CLIENT_BASE_URL: validatedEnv.CLIENT_BASE_URL,
      PYSERVER_URL: validatedEnv.PYSERVER_URL,
      FIREBASE_DATABASE_URL: validatedEnv.FIREBASE_DATABASE_URL,
    };

    Object.entries(urlFields).forEach(([field, url]) => {
      if (!url.startsWith("https://")) {
        errors.push(`${field} must use HTTPS in ${environment} environment`);
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

// Example pattern to use consistently across all API calls
const fetchOptions: RequestInit = {
  // ... other options ...
  headers: {
    "Content-Type": "application/json",
    "openai-api-key": openaiAPIKey,
  },
};

// Apply consistent environment-based redirect handling
if (requiresHttps(environment)) {
  fetchOptions.redirect = "follow";
}
