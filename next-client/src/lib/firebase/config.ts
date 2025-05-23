/**
 * Firebase Configuration
 *
 * Shared configuration used by both client and server Firebase SDKs.
 * Uses environment variables to keep sensitive data secure while
 * allowing the same config to work in both environments.
 */

const requiredKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
] as const;

/**
 * Get Firebase configuration from environment variables.
 * Validates that all required values are present at runtime.
 */
export function getFirebaseConfig() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  // Runtime check for missing config values
  for (const key of requiredKeys) {
    if (!config[key as keyof typeof config]) {
      throw new Error(
        `Missing Firebase config value: ${key}. Check your environment variables.`,
      );
    }
  }

  return config;
}
