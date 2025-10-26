"""
Redis-based LLM response caching for cost and time optimization.

Caches OpenAI API responses to avoid redundant calls during:
- Report retries (primary use case for large 2000+ comment reports)
- Testing iterations (same test data reused)
- Duplicate comments across different reports

Cache Key Strategy:
- Hash of (comment_text, taxonomy_json, model_name, prompt_version)
- Ensures cache hits only for truly identical inputs
- TTL: 24 hours (configurable via REDIS_LLM_CACHE_TTL)

Performance Impact:
- Cache hit: <10ms (Redis lookup)
- Cache miss: 500-2000ms (OpenAI API call)
- Cost savings: $3-4 per retry on large reports
"""

import json
import hashlib
import os
import threading
from typing import Optional, Dict, Any, Tuple
import redis
import logging

logger = logging.getLogger(__name__)

# Cache configuration - hardcoded for simplicity
LLM_CACHE_TTL = 86400  # 24 hours - reasonable TTL for retries and testing iterations
LLM_CACHE_KEY_PREFIX = "llm_cache:v1:"  # Version prefix for cache invalidation
CACHE_SCHEMA_VERSION = "v1"  # Bump when ClaimsSchema structure changes
ENABLE_LLM_CACHE = True  # Always enabled (gracefully degrades if Redis unavailable)

# Redis connection configuration
REDIS_MAX_CONNECTIONS = 50  # Based on Cloud Run max concurrent requests
REDIS_SOCKET_TIMEOUT = 5.0  # Seconds
CACHE_KEY_HASH_LENGTH = 16  # 64-bit keyspace (acceptable collision rate for 24h TTL)

# Global Redis client with thread-safe initialization
_redis_client = None
_redis_lock = threading.Lock()


def get_redis_client() -> redis.Redis:
    """
    Get Redis client from environment with connection pooling.

    Thread-safe singleton pattern with double-check locking.
    """
    global _redis_client

    # Fast path: client already exists
    if _redis_client is not None:
        return _redis_client

    # Slow path: need to create client (thread-safe)
    with _redis_lock:
        # Double-check: another thread may have created it
        if _redis_client is None:
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
            try:
                _redis_client = redis.from_url(
                    redis_url,
                    decode_responses=True,
                    max_connections=REDIS_MAX_CONNECTIONS,
                    socket_keepalive=True,
                    socket_timeout=REDIS_SOCKET_TIMEOUT,
                    socket_connect_timeout=REDIS_SOCKET_TIMEOUT
                )
                # Test connection
                _redis_client.ping()
                logger.info(f"Redis connection established successfully")
            except redis.ConnectionError as e:
                logger.warning(f"Redis connection test failed: {e}, caching will be disabled")
                _redis_client = None
            except Exception as e:
                logger.error(f"Unexpected error initializing Redis: {e}")
                _redis_client = None

        return _redis_client


def close_redis_client():
    """Close Redis connection gracefully (call on shutdown)"""
    global _redis_client
    with _redis_lock:
        if _redis_client is not None:
            try:
                _redis_client.close()
                logger.info("Redis connection closed")
            except Exception as e:
                logger.warning(f"Error closing Redis connection: {e}")
            finally:
                _redis_client = None


def generate_cache_key(
    comment_text: str,
    taxonomy: Dict[str, Any],
    model_name: str,
    system_prompt: str,
    user_prompt_template: str,
    operation: str = "claims",
    schema_version: str = CACHE_SCHEMA_VERSION,
    temperature: float = 0.0
) -> str:
    """
    Generate a deterministic cache key for LLM API calls.

    Args:
        comment_text: The comment being processed
        taxonomy: The taxonomy tree (topics/subtopics)
        model_name: OpenAI model name (e.g., "gpt-4o-mini")
        system_prompt: The complete system prompt (including taxonomy constraints)
        user_prompt_template: The user prompt template (without variable content)
        operation: The operation type (claims, dedup, cruxes, etc.)
        schema_version: Schema version (invalidates cache when schema changes)
        temperature: LLM temperature parameter

    Returns:
        Redis key string
    """
    # Create deterministic representation of inputs
    cache_input = {
        "comment": comment_text.strip(),
        "taxonomy": json.dumps(taxonomy, sort_keys=True),
        "model": model_name,
        "system_prompt": system_prompt,
        "user_prompt_template": user_prompt_template,
        "operation": operation,
        "schema_version": schema_version,
        "temperature": temperature
    }

    # Generate hash with configured length
    cache_string = json.dumps(cache_input, sort_keys=True)
    hash_digest = hashlib.sha256(cache_string.encode()).hexdigest()[:CACHE_KEY_HASH_LENGTH]

    return f"{LLM_CACHE_KEY_PREFIX}{operation}:{hash_digest}"


def get_cached_response(cache_key: str) -> Optional[Dict[str, Any]]:
    """
    Get cached LLM response from Redis.

    Returns:
        Cached response dict or None if cache miss
    """
    if not ENABLE_LLM_CACHE:
        return None

    try:
        client = get_redis_client()
        data = client.get(cache_key)

        if not data:
            logger.debug(f"Cache miss: {cache_key}")
            return None

        response = json.loads(data)
        logger.debug(f"Cache hit: {cache_key}")
        return response

    except Exception as e:
        logger.warning(f"Redis cache read error: {e}")
        return None


def cache_response(cache_key: str, response: Dict[str, Any]) -> bool:
    """
    Cache LLM response in Redis.

    Args:
        cache_key: Cache key from generate_cache_key()
        response: Response dict with claims, usage, etc.

    Returns:
        True if successful, False otherwise
    """
    if not ENABLE_LLM_CACHE:
        return False

    try:
        client = get_redis_client()
        data = json.dumps(response)
        client.setex(cache_key, LLM_CACHE_TTL, data)

        logger.debug(f"Cached response: {cache_key}")
        return True

    except Exception as e:
        logger.warning(f"Redis cache write error: {e}")
        return False


def get_cache_stats() -> Dict[str, Any]:
    """
    Get cache statistics for monitoring.

    Returns:
        Dict with cache size, hit rate estimates, etc.
    """
    try:
        client = get_redis_client()

        # Count keys matching our prefix
        pattern = f"{LLM_CACHE_KEY_PREFIX}*"
        keys = list(client.scan_iter(match=pattern, count=100))

        return {
            "enabled": True,
            "ttl_hours": LLM_CACHE_TTL / 3600,
            "cached_entries": len(keys),
            "key_prefix": LLM_CACHE_KEY_PREFIX
        }

    except Exception as e:
        logger.warning(f"Failed to get cache stats (Redis unavailable?): {e}")
        return {
            "enabled": True,
            "error": "Redis unavailable",
            "cached_entries": 0
        }


def clear_cache(pattern: Optional[str] = None) -> int:
    """
    Clear cache entries matching pattern.

    Args:
        pattern: Optional pattern to match keys (default: all LLM cache keys)

    Returns:
        Number of keys deleted
    """
    try:
        client = get_redis_client()

        if pattern:
            full_pattern = f"{LLM_CACHE_KEY_PREFIX}{pattern}"
        else:
            full_pattern = f"{LLM_CACHE_KEY_PREFIX}*"

        keys = list(client.scan_iter(match=full_pattern, count=1000))

        if keys:
            deleted = client.delete(*keys)
            logger.info(f"Cleared {deleted} cache entries matching {full_pattern}")
            return deleted

        return 0

    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        return 0
