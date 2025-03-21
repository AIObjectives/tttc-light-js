// This should remain on the server
import "server-only";
import { z } from "zod";
import { 
  Environment, 
  EnvValidationError,
  validateEnvironment,
  requiresHttps,
  createUrlValidator
} from "tttc-common/environmentValidation";

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

export const createNextUrlValidator = createUrlValidator;

/**
 * Environment variable validation schema
 * 
 * Development:
 * - PIPELINE_EXPRESS_URL can be HTTP or HTTPS
 * 
 * Production:
 * - PIPELINE_EXPRESS_URL must be HTTPS
 */
export const env = z.object({
  PIPELINE_EXPRESS_URL: createNextUrlValidator("PIPELINE_EXPRESS_URL", {
    requireHttps: requiresHttps(
      process.env.NODE_ENV === "production" ? "prod" : "dev"
    ),
  }),
});

const result = env.safeParse({
  PIPELINE_EXPRESS_URL: process.env.PIPELINE_EXPRESS_URL,
});

if (!result.success) {
  throw new EnvValidationError(
    `❌ Invalid environment variables: \n\n${result.error.errors
      .map((e, i) => {
        return `${i}) [${e.path}]: ${e.message} \n`;
      })
      .join("")}`,
  );
}

/**
 * NextJS server env vars. Next server should fail to start if not present.
 */
export const serverEnv = result.data;

/**
 * Client environment validation schema
 */
export const clientEnv = z.object({
  PIPELINE_EXPRESS_URL: z.string(),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string(),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string(),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string(),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string(),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string(),
  NODE_ENV: z.string().optional().default("development"),
});

export type ClientEnv = z.infer<typeof clientEnv>;

/**
 * Parse and validate client environment variables
 */
export function validateClientEnv(): ClientEnv {
  const parsed = clientEnv.safeParse(process.env);

  if (!parsed.success) {
    throw new EnvValidationError(
      `❌ Invalid client environment variables: \n\n${parsed.error.errors
        .map((e, i) => {
          return `${i}) [${e.path}]: ${e.message} \n`;
        })
        .join("")}`
    );
  }

  // Convert Next.js NODE_ENV to our standardized environment type
  const nodeEnv = parsed.data.NODE_ENV;
  let environment: Environment;
  
  switch(nodeEnv) {
    case "development":
      environment = "dev";
      break;
    case "production":
      // In Next.js, production could be our staging or production
      // We need an additional ENV var to distinguish
      environment = process.env.DEPLOY_ENV === "staging" ? "staging" : "prod";
      break;
    default:
      throw new EnvValidationError(`Invalid NODE_ENV: ${nodeEnv}`);
  }
  
  // Store normalized environment value for internal use
  parsed.data.NODE_ENV = environment;
  
  return parsed.data;
}

/**
 * Get current environment value
 */
export function getEnvironment(): Environment {
  return validateEnvironment(process.env.NODE_ENV);
}

/**
 * Update URL validation to use the common utilities
 */
export function validateServerUrls() {
  const environment = getEnvironment();
  const requireHttps = requiresHttps(environment);
  
  // Create validators with appropriate HTTPS requirements
  const urlValidator = createUrlValidator("Server URL", { requireHttps });
  
  try {
    // Validate URLs with appropriate HTTPS enforcement
    const pipelineUrl = urlValidator.parse(process.env.PIPELINE_EXPRESS_URL);
    // ... validate other URLs ...
    
    return {
      pipelineUrl,
      // ... other validated URLs ...
    };
  } catch (error) {
    console.error("URL validation error:", error);
    throw error;
  }
}
