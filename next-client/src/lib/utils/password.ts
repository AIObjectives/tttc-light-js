import { MIN_PASSWORD_LENGTH } from "@/lib/constants/auth";

/**
 * Checks if password meets minimum length requirement.
 * Follows NIST SP 800-63B guidelines (length-based only, no character type restrictions).
 *
 * Returns a label and color for display. Only shows a message when password is too short.
 */
export function getPasswordStrength(password: string): {
  label: string;
  color: string;
} {
  if (password.length === 0) {
    return { label: "", color: "" };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    const remaining = MIN_PASSWORD_LENGTH - password.length;
    return {
      label: `${remaining} more character${remaining > 1 ? "s" : ""} needed`,
      color: "text-muted-foreground",
    };
  }

  return { label: "", color: "" };
}
