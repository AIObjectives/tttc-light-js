import type { Response } from "express";
import { ERROR_CODES } from "tttc-common/errors";
import { logger } from "tttc-common/logger";
import { FIRESTORE_ID_REGEX } from "tttc-common/utils";
import { z } from "zod";
import { db, getCollectionName, getReportRefById } from "../Firebase";
import { canModifyReport } from "../lib/reportPermissions";
import type { RequestWithAuth } from "../types/request";
import { sendErrorByCode } from "./sendError";

const visibilityLogger = logger.child({ module: "report-visibility" });

// Request body schema
const updateVisibilitySchema = z.object({
  isPublic: z.boolean(),
});

/**
 * Update the visibility (isPublic) of a report.
 * Only the report owner can modify visibility.
 *
 * PATCH /api/report/:reportId/visibility
 * Body: { isPublic: boolean }
 * Returns: { success: true, isPublic: boolean }
 */
export async function updateReportVisibility(
  req: RequestWithAuth,
  res: Response,
) {
  const { reportId } = req.params;

  // Validate reportId format
  if (!reportId || !FIRESTORE_ID_REGEX.test(reportId)) {
    return sendErrorByCode(res, ERROR_CODES.VALIDATION_ERROR, visibilityLogger);
  }

  // Validate request body
  const parseResult = updateVisibilitySchema.safeParse(req.body);
  if (!parseResult.success) {
    visibilityLogger.warn(
      { errors: parseResult.error.issues },
      "Invalid visibility update request body",
    );
    return sendErrorByCode(res, ERROR_CODES.VALIDATION_ERROR, visibilityLogger);
  }

  const { isPublic } = parseResult.data;
  const userId = req.auth.uid;

  try {
    // Get the report to check ownership
    const reportRef = await getReportRefById(reportId);

    if (!reportRef) {
      return sendErrorByCode(
        res,
        ERROR_CODES.REPORT_NOT_FOUND,
        visibilityLogger,
      );
    }

    // Check if user is the owner (only owner can modify visibility)
    if (!canModifyReport(reportRef, userId)) {
      visibilityLogger.warn(
        { reportId, userId, ownerId: reportRef.userId },
        "Non-owner attempted to modify report visibility",
      );
      // Return 404 to not reveal existence of reports the user doesn't own
      return sendErrorByCode(
        res,
        ERROR_CODES.REPORT_NOT_FOUND,
        visibilityLogger,
      );
    }

    // Update the visibility
    const docRef = db.collection(getCollectionName("REPORT_REF")).doc(reportId);
    await docRef.update({ isPublic });

    visibilityLogger.info(
      { reportId, userId, isPublic },
      "Report visibility updated",
    );

    return res.json({
      success: true,
      isPublic,
    });
  } catch (error) {
    visibilityLogger.error(
      { error, reportId, userId },
      "Failed to update report visibility",
    );
    return sendErrorByCode(
      res,
      ERROR_CODES.SERVICE_UNAVAILABLE,
      visibilityLogger,
    );
  }
}
