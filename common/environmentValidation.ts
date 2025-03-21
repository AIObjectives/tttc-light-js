import { z } from "zod";

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

/**
 * Custom error class for environment validation errors
 */
export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvValidationError";
  }
}

/**
 * Validates environment type
 */
export const validateEnvironment = (env: string | undefined): Environment => {
  if (!env || !["dev", "staging", "prod"].includes(env.toLowerCase())) {
    throw new EnvValidationError("Environment not set: NODE_ENV must be 'dev', 'staging', or 'prod'");
  }
  return env.toLowerCase() as Environment;
};

/**
 * Creates a URL validator with optional HTTPS requirement
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
 */
export const createPortValidator = (fieldName: string) => {
  return z.string()
    .transform((val) => parseInt(val, 10))
    .refine((port) => !isNaN(port) && port > 0 && port < 65536, {
      message: `${fieldName} must be a valid port number`,
    });
};

/**
 * Determines if HTTPS is required based on environment
 */
export const requiresHttps = (environment: Environment): boolean => {
  return environment === "prod" || environment === "staging";
}; 