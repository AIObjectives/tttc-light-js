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
      error: "PIPELINE_EXPRESS_URL env var is missing. This is required.",
    })
    .url("PIPELINE_EXPRESS_URL env var should be a valid url"),
  // Phone number for the elicitation bot (WhatsApp). Used to generate
  // wa.me links on the study detail page with the event ID as the message.
  // Include country code, e.g. 12345678900
  NEXT_PUBLIC_ELICITATION_BOT_PHONE: z.string().optional(),
});

const result = env.safeParse({
  PIPELINE_EXPRESS_URL: process.env.PIPELINE_EXPRESS_URL,
  NEXT_PUBLIC_ELICITATION_BOT_PHONE:
    process.env.NEXT_PUBLIC_ELICITATION_BOT_PHONE,
});

if (!result.success) {
  throw new EnvValidationError(
    `There are error(s) with your next-js env: \n \n${result.error.issues
      .map((e: { message: string }, i: number) => {
        return `${i}) ${e.message} \n`;
      })
      .join("")}`,
  );
}

/**
 * NextJS server env vars. Next server should fail to start if not present.
 */
export const validatedServerEnv = result.data;
