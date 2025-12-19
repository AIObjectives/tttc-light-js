/**
 * Firebase Configuration
 *
 * Shared configuration used by both client and server Firebase SDKs.
 * Uses environment variables that are embedded at build time.
 *
 * NEXT_PUBLIC_ variables are available in the browser after build.
 * Regular env vars are only available on the server side.
 */

import { z } from "zod";

const _requiredKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
] as const;

// Validate the config at build time
const configSchema = z.object({
  apiKey: z.string().min(1),
  authDomain: z.string().min(1),
  projectId: z.string().min(1),
  storageBucket: z.string().min(1),
  messagingSenderId: z.string().min(1),
  appId: z.string().min(1),
});

const rawConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const parsed = configSchema.safeParse(rawConfig);

if (!parsed.success) {
  throw new Error(
    `Invalid Firebase configuration: ${parsed.error.message}. Make sure all NEXT_PUBLIC_FIREBASE_* environment variables are set.`,
  );
}

// Store the validated config - TypeScript now knows parsing was successful
const validatedConfig = parsed.data;

/**
 * Get Firebase configuration from environment variables.
 * Variables are embedded at build time via Next.js.
 */
export function getFirebaseConfig() {
  return validatedConfig;
}
