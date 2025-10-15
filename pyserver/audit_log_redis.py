"""
Redis-based audit log state management for Python pipeline.

Provides access to audit logs stored in Redis during pipeline execution.
Matches the TypeScript implementation in express-server/src/utils/auditLogRedis.ts
"""

import json
import os
from typing import Optional
import redis
from audit_logger import ProcessingAuditLogger
import logging

logger = logging.getLogger(__name__)

AUDIT_LOG_TTL = 21600  # 6 hours - generous TTL for long-running pipelines
AUDIT_LOG_KEY_PREFIX = "audit_log:"


def get_redis_client() -> redis.Redis:
    """Get Redis client from environment"""
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    return redis.from_url(redis_url, decode_responses=True)


def get_audit_log_key(report_id: str) -> str:
    """Get the Redis key for an audit log by report ID"""
    return f"{AUDIT_LOG_KEY_PREFIX}{report_id}"


def get_audit_log_from_redis(report_id: str) -> Optional[ProcessingAuditLogger]:
    """
    Get audit log from Redis and restore as ProcessingAuditLogger.

    Returns None if not found or invalid.
    """
    try:
        client = get_redis_client()
        key = get_audit_log_key(report_id)
        data = client.get(key)

        if not data:
            logger.info(f"Audit log not found in Redis for report {report_id}")
            return None

        artifact = json.loads(data)
        audit_logger = ProcessingAuditLogger.from_artifact(artifact)

        logger.info(f"Retrieved audit log from Redis for report {report_id} with {len(audit_logger.entries)} entries")
        return audit_logger

    except Exception as e:
        logger.error(f"Failed to get audit log from Redis for report {report_id}: {e}")
        return None


def save_audit_log_to_redis(audit_logger: ProcessingAuditLogger) -> bool:
    """
    Save audit log to Redis.

    Returns True if successful, False otherwise.
    """
    try:
        client = get_redis_client()
        key = get_audit_log_key(audit_logger.report_id)
        artifact = audit_logger.to_artifact()
        data = json.dumps(artifact)

        client.setex(key, AUDIT_LOG_TTL, data)

        logger.info(
            f"Saved audit log to Redis for report {audit_logger.report_id} "
            f"with {len(audit_logger.entries)} entries"
        )
        return True

    except Exception as e:
        logger.error(
            f"Failed to save audit log to Redis for report {audit_logger.report_id}: {e}"
        )
        return False
