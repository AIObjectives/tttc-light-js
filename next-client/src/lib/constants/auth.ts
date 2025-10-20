/**
 * Authentication-related constants
 */

export const AUTH_ACTIONS = {
  SIGNIN: "signin",
} as const;

export const ACTION_MODES = {
  RESET_PASSWORD: "resetPassword",
  VERIFY_EMAIL: "verifyEmail",
  RECOVER_EMAIL: "recoverEmail",
} as const;

/**
 * Minimum password length following NIST SP 800-63B guidelines
 * (length-based requirements only, no character type restrictions)
 */
export const MIN_PASSWORD_LENGTH = 18;

export type AuthAction = (typeof AUTH_ACTIONS)[keyof typeof AUTH_ACTIONS];
export type ActionMode = (typeof ACTION_MODES)[keyof typeof ACTION_MODES];
