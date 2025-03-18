// config.ts
import { z } from "zod";

// Define the configuration statically - this ensures it's available at build time
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

// Validate the config
const configSchema = z.object({
  apiKey: z.string(),
  authDomain: z.string(),
  projectId: z.string(),
  storageBucket: z.string(),
  messagingSenderId: z.string(),
  appId: z.string(),
});

const parsed = configSchema.safeParse(firebaseConfig);

if (!parsed.success) {
  throw new Error(
    `Invalid Firebase configuration: ${parsed.error.message}. Make sure all environment variables are set.`,
  );
}

export const validatedFirebaseConfig = parsed.data;

//console.log(validatedFirebaseConfig);
