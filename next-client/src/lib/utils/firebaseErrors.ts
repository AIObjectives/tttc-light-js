import { MIN_PASSWORD_LENGTH } from "@/lib/constants/auth";

/**
 * Maps Firebase Auth error codes to user-friendly messages.
 * Provides consistent error messaging across all auth components.
 *
 * SECURITY: Error messages are intentionally vague to prevent email enumeration.
 * We don't reveal whether an email is registered or not.
 */
export function getFirebaseErrorMessage(errorCode: string): string {
  switch (errorCode) {
    // Sign up errors - vague message to prevent email enumeration
    case "auth/email-already-in-use":
      return "Unable to create account. Please try again or sign in if you already have an account.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    case "auth/operation-not-allowed":
      return "Email/password sign-in is not enabled. Please contact support.";

    // Sign in errors - same vague message for all credential issues
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password.";

    // Rate limiting
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";

    // Network errors
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";

    // Password reset errors
    case "auth/expired-action-code":
      return "This link has expired. Please request a new password reset.";
    case "auth/invalid-action-code":
      return "This link is invalid or has already been used.";

    // User disabled
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";

    default:
      return "An error occurred. Please try again.";
  }
}
