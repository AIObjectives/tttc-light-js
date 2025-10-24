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
const LARGE_UPLOAD_CSV_SIZE_LIMIT = 4 * 1024 * 1024; // 4MB
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
 * Get the CSV size limit for a user based on their roles
 * @param roles Array of role strings from the user document
 * @returns Maximum allowed CSV file size in bytes
 */
export function getUserCsvSizeLimit(roles: string[]): number {
  // Check if user has large_uploads role
  if (roles.includes("large_uploads")) {
    return CAPABILITIES.large_uploads.csvSizeLimit;
  }

  // Return default limit
  return DEFAULT_LIMITS.csvSizeLimit;
}

/**
 * Get user capabilities based on their roles
 * @param roles Array of role strings from the user document
 * @returns Object containing all user capabilities
 */
export function getUserCapabilities(roles: string[]) {
  return {
    csvSizeLimit: getUserCsvSizeLimit(roles),
    // Future capabilities can be added here
  };
}
