// This should remain on the server
import "server-only";
import { z } from "zod";
import { createUrlValidator } from "../../express-server/src/types/context";

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
 * Environment variable validation schema
 * 
 * Development:
 * - PIPELINE_EXPRESS_URL can be HTTP or HTTPS
 * 
 * Production:
 * - PIPELINE_EXPRESS_URL must be HTTPS
 */
export const env = z.object({
  PIPELINE_EXPRESS_URL: createUrlValidator("PIPELINE_EXPRESS_URL", {
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
