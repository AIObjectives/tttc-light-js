// This should remain on the server
import "server-only";
import { z } from "zod";
//import { createUrlValidator } from "../../express-server/src/types/context";

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
export type Environment = "dev" | "staging" | "prod";

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

export const createNextUrlValidator = (fieldName: string, config: EnvConfig = {}) => {
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
    requireHttps: process.env.NODE_ENV === "production",
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
