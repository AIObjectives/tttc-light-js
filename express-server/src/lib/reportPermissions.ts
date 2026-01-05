import type { ReportRef } from "tttc-common/firebase";
import { logger } from "tttc-common/logger";

const permissionLogger = logger.child({ module: "report-permissions" });

export interface ReportAccessResult {
  allowed: boolean;
  reason: "owner" | "public" | "legacy" | "denied";
}

/**
 * Check if a user has access to view a report.
 *
 * Access rules:
 * - Owner always has access (regardless of visibility)
 * - Explicitly public reports (isPublic === true) are accessible to anyone
 * - Legacy reports (isPublic === undefined) are grandfathered as public
 * - Explicitly private reports (isPublic === false) are only accessible to owner
 *
 * @param reportRef - The report reference document
 * @param requestingUserId - The UID of the requesting user (undefined if unauthenticated)
 * @returns Access result with allowed status and reason
 */
export function checkReportAccess(
  reportRef: ReportRef,
  requestingUserId: string | undefined,
): ReportAccessResult {
  // Owner always has access
  if (requestingUserId && reportRef.userId === requestingUserId) {
    return { allowed: true, reason: "owner" };
  }

  // Explicitly public
  if (reportRef.isPublic === true) {
    return { allowed: true, reason: "public" };
  }

  // Legacy (no isPublic field) - grandfathered as public
  if (reportRef.isPublic === undefined) {
    return { allowed: true, reason: "legacy" };
  }

  // Explicitly private (isPublic === false)
  permissionLogger.info(
    { reportId: reportRef.id, requestingUserId },
    "Access denied to private report",
  );
  return { allowed: false, reason: "denied" };
}

/**
 * Check if a user can modify a report (e.g., change visibility).
 * Only the report owner can modify their reports.
 *
 * @param reportRef - The report reference document
 * @param userId - The UID of the user attempting to modify
 * @returns true if the user is the owner
 */
export function canModifyReport(
  reportRef: ReportRef,
  userId: string | undefined,
): boolean {
  return !!userId && reportRef.userId === userId;
}
