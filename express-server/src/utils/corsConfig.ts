import { logger } from "tttc-common/logger";
import type { Env } from "../types/context";

const corsLogger = logger.child({ module: "cors" });

// CORS Security Constants - Keep in sync with Python server
export const PREFLIGHT_CACHE_SECONDS = 24 * 60 * 60; // 24 hours

export interface CorsOriginConfig {
  origins: string[];
  environment: string;
}

/**
 * Get allowed origins based on environment configuration
 * Handles development vs production logic consistently
 */
export function getAllowedOrigins(env: Env): CorsOriginConfig {
  // Use only explicitly configured origins in all environments
  // No more automatic defaults to prevent dev/prod discrepancies
  return {
    origins: env.ALLOWED_ORIGINS,
    environment: env.NODE_ENV,
  };
}

/**
 * CORS origin validation function with proper error handling and logging
 */
export function createCorsOriginValidator(allowedOrigins: string[]) {
  return (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    try {
      // Allow requests with no origin (server-to-server communication, mobile apps, etc.)
      // Note: Requests without origin headers are typically from server-to-server calls,
      // mobile apps, or tools like Postman. We allow these in all environments.
      if (!origin) {
        corsLogger.debug("Allowing request with no origin header");
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        corsLogger.debug({ origin }, "Allowed origin");
        callback(null, true);
      } else {
        const error = new Error(`Origin ${origin} not allowed by CORS policy`);
        corsLogger.warn(
          {
            origin,
            allowedOrigins,
            timestamp: new Date().toISOString(),
          },
          "Blocked origin",
        );
        callback(error);
      }
    } catch (err) {
      // Handle unexpected errors in CORS validation
      corsLogger.error(
        {
          error: err,
          origin: origin || "undefined",
          allowedOriginsCount: allowedOrigins.length,
        },
        "Unexpected error in origin validation",
      );
      // Fail secure: reject on unexpected errors
      callback(new Error("CORS validation failed due to internal error"));
    }
  };
}

/**
 * Standard CORS options configuration
 * Centralized to ensure consistency across all services
 */
export function createCorsOptions(allowedOrigins: string[]) {
  return {
    origin: createCorsOriginValidator(allowedOrigins),
    credentials: true, // Enable credentials (cookies, authorization headers)
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "X-OpenAI-API-Key", // Allow custom headers for API keys
    ],
    optionsSuccessStatus: 200, // For legacy browser support
    maxAge: PREFLIGHT_CACHE_SECONDS, // Cache preflight
  };
}

/**
 * Log CORS configuration on startup for debugging
 */
export function logCorsConfiguration(config: CorsOriginConfig) {
  corsLogger.info(
    {
      environment: config.environment,
      allowedOrigins: config.origins,
      preflightCacheSeconds: PREFLIGHT_CACHE_SECONDS,
    },
    "Configuration initialized",
  );
}
