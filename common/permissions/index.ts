/**
 * Simple permission system for role-based capabilities
 * Server-authoritative: all permission checks happen on the backend
 */

/**
 * Role capabilities mapping
 * Each role grants specific capabilities to users
 */
/**
 * CSV size limits in bytes
 */
const LARGE_UPLOAD_CSV_SIZE_LIMIT = 2 * 1024 * 1024; // 2MB
const DEFAULT_CSV_SIZE_LIMIT = 150 * 1024; // 150KB

export const CAPABILITIES = {
  large_uploads: {
    csvSizeLimit: LARGE_UPLOAD_CSV_SIZE_LIMIT,
  },
  // Future roles can be added here as needed
} as const;

/**
 * Default limits for users without special roles
 */
export const DEFAULT_LIMITS = {
  csvSizeLimit: DEFAULT_CSV_SIZE_LIMIT,
} as const;

/**
 * Get the CSV size limit for a user based on their roles and feature flags
 * @param roles Array of role strings from the user document
 * @param largeUploadsEnabled System-wide feature flag (from PostHog/environment) that controls
 *                            whether users with the large_uploads role can actually use larger limits.
 *                            This is NOT a user-specific setting.
 * @returns Maximum allowed CSV file size in bytes
 */
export function getUserCsvSizeLimit(
  roles: string[],
  largeUploadsEnabled: boolean = false,
): number {
  // Check if user has large_uploads role AND feature flag is enabled
  if (roles.includes("large_uploads") && largeUploadsEnabled) {
    return CAPABILITIES.large_uploads.csvSizeLimit;
  }

  // Return default limit
  return DEFAULT_LIMITS.csvSizeLimit;
}

/**
 * Get user capabilities based on their roles and current system configuration
 * @param roles Array of role strings from the user document
 * @param largeUploadsEnabled System-wide feature flag (from PostHog/environment) that controls
 *                            whether users with the large_uploads role can actually use larger limits.
 *                            This is NOT a user-specific setting.
 * @returns Object containing all user capabilities
 */
export function getUserCapabilities(
  roles: string[],
  largeUploadsEnabled: boolean = false,
) {
  return {
    csvSizeLimit: getUserCsvSizeLimit(roles, largeUploadsEnabled),
    // Future capabilities can be added here
  };
}
