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
import time
import asyncio
from typing import Optional, Dict, Any, Tuple, List
from redis import asyncio as aioredis
import logging

logger = logging.getLogger(__name__)

# Cache configuration - hardcoded for simplicity
LLM_CACHE_TTL = 86400  # 24 hours - reasonable TTL for retries and testing iterations
LLM_CACHE_KEY_PREFIX = "llm_cache:v1:"  # Version prefix for cache invalidation
CACHE_SCHEMA_VERSION = "v1"  # Bump when ClaimsSchema structure changes
ENABLE_LLM_CACHE = True  # Always enabled (gracefully degrades if Redis unavailable)

# Redis connection configuration
REDIS_MAX_CONNECTIONS = 10  # Reduced to prevent connection pool saturation with async concurrency
REDIS_SOCKET_TIMEOUT = 30.0  # Increased timeout for async operations under load
CACHE_KEY_HASH_LENGTH = 16  # 64-bit keyspace (acceptable collision rate for 24h TTL)

# Global async Redis client with async lock
_redis_client: Optional[aioredis.Redis] = None
_redis_lock = asyncio.Lock()


async def get_redis_client() -> Optional[aioredis.Redis]:
    """
    Get async Redis client from environment with connection pooling.

    Async singleton pattern with double-check locking.
    """
    global _redis_client

    # Fast path: client already exists
    if _redis_client is not None:
        return _redis_client

    # Slow path: need to create client (async-safe)
    async with _redis_lock:
        # Double-check: another coroutine may have created it
        if _redis_client is None:
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
            try:
                _redis_client = await aioredis.from_url(
                    redis_url,
                    decode_responses=True,
                    max_connections=REDIS_MAX_CONNECTIONS,
                    socket_keepalive=True,
                    socket_timeout=REDIS_SOCKET_TIMEOUT,
                    socket_connect_timeout=REDIS_SOCKET_TIMEOUT
                )
                # Test connection
                await _redis_client.ping()
                logger.info(f"Async Redis connection established successfully")
            except aioredis.ConnectionError as e:
                logger.warning(f"Redis connection test failed: {e}, caching will be disabled")
                _redis_client = None
            except Exception as e:
                logger.error(f"Unexpected error initializing Redis: {e}")
                _redis_client = None

        return _redis_client


async def close_redis_client():
    """Close Redis connection gracefully (call on shutdown)"""
    global _redis_client
    async with _redis_lock:
        if _redis_client is not None:
            try:
                await _redis_client.close()
                logger.info("Async Redis connection closed")
            except Exception as e:
                logger.warning(f"Error closing Redis connection: {e}")
            finally:
                _redis_client = None


def normalize_taxonomy_for_cache(taxonomy: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Normalize taxonomy to only include stable fields for cache key generation.

    Excludes LLM-generated descriptions and metadata that may vary between runs:
    - topicShortDescription (LLM-generated, non-deterministic)
    - subtopicShortDescription (LLM-generated, non-deterministic)
    - topicId (random UUID added post-processing)
    - claimsCount (metadata added post-processing)

    Only includes stable identifiers:
    - topicName (stable)
    - subtopics.subtopicName (stable)

    Args:
        taxonomy: Full taxonomy list with all fields

    Returns:
        Normalized taxonomy with only stable fields

    Note:
        This normalization makes cache keys resilient to description changes,
        but if taxonomy STRUCTURE changes (different topics/subtopics),
        the cache will correctly miss.
    """
    if not taxonomy:
        logger.warning("Empty taxonomy provided for normalization")
        return []

    if not isinstance(taxonomy, list):
        logger.error(f"Taxonomy is not a list: {type(taxonomy)}")
        return []

    normalized = []
    for i, topic in enumerate(taxonomy):
        # Validate topic is a dict
        if not isinstance(topic, dict):
            logger.error(f"Topic {i} is not a dict: {type(topic)}, skipping")
            continue

        # Get topicName with validation
        topic_name = topic.get("topicName", "")
        if not topic_name:
            logger.warning(f"Topic {i} has empty topicName, skipping")
            continue

        # Get subtopics with defensive handling
        subtopics_raw = topic.get("subtopics")
        if subtopics_raw is None:
            subtopics_raw = []
        elif not isinstance(subtopics_raw, list):
            logger.warning(f"Topic '{topic_name}' has non-list subtopics: {type(subtopics_raw)}, treating as empty")
            subtopics_raw = []

        # Normalize subtopics
        normalized_subtopics = []
        for j, sub in enumerate(subtopics_raw):
            if not isinstance(sub, dict):
                logger.warning(f"Topic '{topic_name}' subtopic {j} is not a dict: {type(sub)}, skipping")
                continue

            subtopic_name = sub.get("subtopicName", "")
            if not subtopic_name:
                logger.warning(f"Topic '{topic_name}' subtopic {j} has empty subtopicName, skipping")
                continue

            normalized_subtopics.append({"subtopicName": subtopic_name})

        normalized_topic = {
            "topicName": topic_name,
            "subtopics": normalized_subtopics
        }
        normalized.append(normalized_topic)

    return normalized


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

    IMPORTANT CACHE KEY DESIGN:
    - system_prompt parameter should be the BASE prompt WITHOUT taxonomy constraints
    - This is intentional - we want cache hits even if taxonomy DESCRIPTIONS vary
    - Taxonomy STRUCTURE (topic/subtopic names) is captured in normalized taxonomy
    - If taxonomy structure changes (different topics/subtopics), cache correctly misses
    - This design trades off prompt accuracy in cache key for better cache hit rates

    Args:
        comment_text: The comment being processed
        taxonomy: The taxonomy tree (topics/subtopics) - will be normalized
        model_name: OpenAI model name (e.g., "gpt-4o-mini")
        system_prompt: The BASE system prompt (WITHOUT taxonomy constraints)
        user_prompt_template: The user prompt template (without variable content)
        operation: The operation type (claims, dedup, cruxes, etc.)
        schema_version: Schema version (invalidates cache when schema changes)
        temperature: LLM temperature parameter

    Returns:
        Redis key string in format: llm_cache:v1:{operation}:{hash}
    """
    # Normalize taxonomy to only include stable fields (topicName, subtopicName)
    # Exclude LLM-generated descriptions that vary between runs
    # This makes cache resilient to description changes while still invalidating
    # when taxonomy structure (different topics/subtopics) changes
    normalized_taxonomy = normalize_taxonomy_for_cache(taxonomy)

    # Create deterministic representation of inputs
    cache_input = {
        "comment": comment_text.strip(),
        "taxonomy": json.dumps(normalized_taxonomy, sort_keys=True),
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


async def get_cached_response(cache_key: str) -> Optional[Dict[str, Any]]:
    """
    Get cached LLM response from Redis (async).

    Returns:
        Cached response dict or None if cache miss
    """
    if not ENABLE_LLM_CACHE:
        return None

    start_time = time.time()

    try:
        client = await get_redis_client()
        if client is None:
            return None

        data = await client.get(cache_key)
        duration_ms = (time.time() - start_time) * 1000

        if not data:
            logger.info(f"Cache miss: {cache_key} ({duration_ms:.1f}ms)")
            return None

        response = json.loads(data)
        logger.info(f"Cache hit: {cache_key} ({duration_ms:.1f}ms)")
        return response

    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.warning(f"Redis cache read error after {duration_ms:.1f}ms: {e}")
        return None


async def cache_response(cache_key: str, response: Dict[str, Any]) -> bool:
    """
    Cache LLM response in Redis (async).

    Args:
        cache_key: Cache key from generate_cache_key()
        response: Response dict with claims, usage, etc.

    Returns:
        True if successful, False otherwise
    """
    if not ENABLE_LLM_CACHE:
        return False

    start_time = time.time()

    try:
        client = await get_redis_client()
        if client is None:
            return False

        data = json.dumps(response)
        await client.setex(cache_key, LLM_CACHE_TTL, data)
        duration_ms = (time.time() - start_time) * 1000

        logger.debug(f"Cached response: {cache_key} ({duration_ms:.1f}ms, {len(data)} bytes)")
        return True

    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.warning(f"Redis cache write error after {duration_ms:.1f}ms: {e}")
        return False


async def get_cache_stats() -> Dict[str, Any]:
    """
    Get cache statistics for monitoring (async).

    Returns:
        Dict with cache size, hit rate estimates, etc.
    """
    try:
        client = await get_redis_client()
        if client is None:
            return {
                "enabled": True,
                "error": "Redis unavailable",
                "cached_entries": 0
            }

        # Count keys matching our prefix
        pattern = f"{LLM_CACHE_KEY_PREFIX}*"
        keys = []
        async for key in client.scan_iter(match=pattern, count=100):
            keys.append(key)

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


async def clear_cache(pattern: Optional[str] = None) -> int:
    """
    Clear cache entries matching pattern (async).

    Args:
        pattern: Optional pattern to match keys (default: all LLM cache keys)

    Returns:
        Number of keys deleted
    """
    try:
        client = await get_redis_client()
        if client is None:
            return 0

        if pattern:
            full_pattern = f"{LLM_CACHE_KEY_PREFIX}{pattern}"
        else:
            full_pattern = f"{LLM_CACHE_KEY_PREFIX}*"

        keys = []
        async for key in client.scan_iter(match=full_pattern, count=1000):
            keys.append(key)

        if keys:
            deleted = await client.delete(*keys)
            logger.info(f"Cleared {deleted} cache entries matching {full_pattern}")
            return deleted

        return 0

    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        return 0
