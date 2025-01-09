// This should remain on the server
import "server-only";
import { z } from "zod";

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

const env = z.object({
  // Endpoint for the TS server.
  // TODO: Rename this to something like express server url or something?
  PIPELINE_EXPRESS_URL: z
    .string({
      required_error:
        "PIPELINE_EXPRESS_URL env var is missing. This is a required.",
    })
    .url("PIPELINE_EXPRESS_URL env var should be a valid url"),
});

const result = env.safeParse({
  PIPELINE_EXPRESS_URL: process.env["PIPELINE_EXPRESS_URL"],
});

if (!result.success) {
  throw new EnvValidationError(
    `There are error(s) with your next-js env: \n \n${result.error.errors
      .map((e, i) => {
        return `${i}) ${e.message} \n`;
      })
      .join("")}`,
  );
}

/**
 * NextJS server env vars. Next server should fail to start if not present.
 */
export const validatedServerEnv = result.data;
