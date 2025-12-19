/**
 * Redis-based audit log state management
 *
 * Provides clean separation between audit log state and functional request payloads.
 * Audit logs are stored in Redis during pipeline execution and cleaned up automatically.
 */

import type Redis from "ioredis";
import { logger } from "tttc-common/logger";
import type { ProcessingAuditLog } from "tttc-common/schema";
import { processingAuditLog } from "tttc-common/schema";

const auditLogLogger = logger.child({ module: "audit-log-redis" });

const AUDIT_LOG_TTL = 21600; // 6 hours - generous TTL for long-running pipelines
const AUDIT_LOG_KEY_PREFIX = "audit_log:";

/**
 * Get the Redis key for an audit log by report ID
 */
function getAuditLogKey(reportId: string): string {
  return `${AUDIT_LOG_KEY_PREFIX}${reportId}`;
}

/**
 * Initialize audit log in Redis for a new report
 */
export async function initializeAuditLog(
  redis: Redis,
  reportId: string,
  inputCommentCount: number,
  modelName: string = "gpt-4o-mini", // Default model, can be overridden
): Promise<void> {
  const key = getAuditLogKey(reportId);

  const initialLog: ProcessingAuditLog = {
    version: "1.0",
    reportId,
    createdAt: new Date().toISOString(),
    inputCommentCount,
    finalQuoteCount: 0,
    modelName,
    entries: [],
    summary: {
      rejectedBySanitization: 0,
      rejectedByMeaningfulness: 0,
      rejectedByClaimsExtraction: 0,
      deduplicated: 0,
      accepted: 0,
    },
  };

  await redis.setex(key, AUDIT_LOG_TTL, JSON.stringify(initialLog));

  auditLogLogger.info(
    { reportId, inputCommentCount, modelName },
    "Initialized audit log in Redis",
  );
}

/**
 * Get audit log from Redis
 * Returns null if not found or invalid
 */
export async function getAuditLog(
  redis: Redis,
  reportId: string,
): Promise<ProcessingAuditLog | null> {
  const key = getAuditLogKey(reportId);
  const data = await redis.get(key);

  if (!data) {
    auditLogLogger.warn({ reportId }, "Audit log not found in Redis");
    return null;
  }

  try {
    const parsed = JSON.parse(data);
    const validated = processingAuditLog.parse(parsed);
    return validated;
  } catch (error) {
    // Log Zod validation errors with full details
    if (error instanceof Error && "issues" in error) {
      auditLogLogger.error(
        { reportId, error, zodIssues: (error as any).issues },
        "Failed to parse audit log from Redis - Zod validation failed",
      );
    } else {
      auditLogLogger.error(
        { reportId, error },
        "Failed to parse audit log from Redis",
      );
    }
    return null;
  }
}

/**
 * Save audit log to Redis (replaces existing)
 */
export async function saveAuditLog(
  redis: Redis,
  auditLog: ProcessingAuditLog,
): Promise<void> {
  const key = getAuditLogKey(auditLog.reportId);
  await redis.setex(key, AUDIT_LOG_TTL, JSON.stringify(auditLog));

  auditLogLogger.debug(
    { reportId: auditLog.reportId, entryCount: auditLog.entries.length },
    "Saved audit log to Redis",
  );
}

/**
 * Delete audit log from Redis
 * Called after final storage to clean up
 */
export async function deleteAuditLog(
  redis: Redis,
  reportId: string,
): Promise<void> {
  const key = getAuditLogKey(reportId);
  await redis.del(key);

  auditLogLogger.debug({ reportId }, "Deleted audit log from Redis");
}
