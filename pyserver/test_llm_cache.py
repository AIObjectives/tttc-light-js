#!/usr/bin/env python

"""
Tests for LLM response caching functionality.

Tests cover:
- Cache key generation (deterministic, collision-resistant)
- Cache hit/miss scenarios
- Redis failure handling (graceful degradation)
- Cache statistics
- Cache clearing
"""

import json
import hashlib
from unittest.mock import Mock, patch, MagicMock

# Import the module under test
from llm_cache_redis import (
    generate_cache_key,
    get_cached_response,
    cache_response,
    get_cache_stats,
    clear_cache,
    LLM_CACHE_KEY_PREFIX,
    LLM_CACHE_TTL,
    ENABLE_LLM_CACHE
)


class TestCacheKeyGeneration:
    """Test cache key generation is deterministic and collision-resistant."""

    def test_identical_inputs_same_key(self):
        """Identical inputs should produce identical cache keys."""
        comment = "I love renewable energy"
        taxonomy = [{"topicName": "Energy", "subtopics": []}]
        model = "gpt-4o-mini"
        system_prompt = "You are a research assistant"
        user_prompt = "Extract claims"

        key1 = generate_cache_key(comment, taxonomy, model, system_prompt, user_prompt)
        key2 = generate_cache_key(comment, taxonomy, model, system_prompt, user_prompt)

        assert key1 == key2, "Identical inputs should produce identical keys"
        print(f"✅ Identical inputs produce same key: {key1}")

    def test_different_comments_different_keys(self):
        """Different comments should produce different cache keys."""
        taxonomy = [{"topicName": "Energy", "subtopics": []}]
        model = "gpt-4o-mini"
        system_prompt = "You are a research assistant"
        user_prompt = "Extract claims"

        key1 = generate_cache_key("Comment A", taxonomy, model, system_prompt, user_prompt)
        key2 = generate_cache_key("Comment B", taxonomy, model, system_prompt, user_prompt)

        assert key1 != key2, "Different comments should produce different keys"
        print(f"✅ Different comments produce different keys")

    def test_different_taxonomy_different_keys(self):
        """Different taxonomy should produce different cache keys."""
        comment = "I love renewable energy"
        taxonomy1 = [{"topicName": "Energy", "subtopics": []}]
        taxonomy2 = [{"topicName": "Climate", "subtopics": []}]
        model = "gpt-4o-mini"
        system_prompt = "You are a research assistant"
        user_prompt = "Extract claims"

        key1 = generate_cache_key(comment, taxonomy1, model, system_prompt, user_prompt)
        key2 = generate_cache_key(comment, taxonomy2, model, system_prompt, user_prompt)

        assert key1 != key2, "Different taxonomy should produce different keys"
        print(f"✅ Different taxonomy produces different keys")

    def test_different_model_different_keys(self):
        """Different model should produce different cache keys."""
        comment = "I love renewable energy"
        taxonomy = [{"topicName": "Energy", "subtopics": []}]
        system_prompt = "You are a research assistant"
        user_prompt = "Extract claims"

        key1 = generate_cache_key(comment, taxonomy, "gpt-4o-mini", system_prompt, user_prompt)
        key2 = generate_cache_key(comment, taxonomy, "gpt-4o", system_prompt, user_prompt)

        assert key1 != key2, "Different model should produce different keys"
        print(f"✅ Different model produces different keys")

    def test_different_prompts_different_keys(self):
        """Different prompts should produce different cache keys."""
        comment = "I love renewable energy"
        taxonomy = [{"topicName": "Energy", "subtopics": []}]
        model = "gpt-4o-mini"

        key1 = generate_cache_key(comment, taxonomy, model, "System A", "User A")
        key2 = generate_cache_key(comment, taxonomy, model, "System B", "User B")

        assert key1 != key2, "Different prompts should produce different keys"
        print(f"✅ Different prompts produce different keys")

    def test_key_format(self):
        """Cache key should have expected format."""
        comment = "Test comment"
        taxonomy = [{"topicName": "Test", "subtopics": []}]
        model = "gpt-4o-mini"
        system_prompt = "System"
        user_prompt = "User"

        key = generate_cache_key(comment, taxonomy, model, system_prompt, user_prompt, operation="claims")

        assert key.startswith(LLM_CACHE_KEY_PREFIX + "claims:"), "Key should have correct prefix"
        assert len(key) > len(LLM_CACHE_KEY_PREFIX + "claims:"), "Key should have hash component"
        print(f"✅ Cache key format correct: {key}")

    def test_whitespace_trimming(self):
        """Leading/trailing whitespace should not affect cache key."""
        taxonomy = [{"topicName": "Energy", "subtopics": []}]
        model = "gpt-4o-mini"
        system_prompt = "You are a research assistant"
        user_prompt = "Extract claims"

        key1 = generate_cache_key("  comment  ", taxonomy, model, system_prompt, user_prompt)
        key2 = generate_cache_key("comment", taxonomy, model, system_prompt, user_prompt)

        assert key1 == key2, "Whitespace trimming should make keys identical"
        print(f"✅ Whitespace trimming works correctly")


class TestCacheOperations:
    """Test cache read/write operations with mocked Redis."""

    @patch('llm_cache_redis.get_redis_client')
    def test_cache_miss(self, mock_get_client):
        """Test cache miss returns None."""
        mock_redis = Mock()
        mock_redis.get.return_value = None
        mock_get_client.return_value = mock_redis

        result = get_cached_response("test_key")

        assert result is None, "Cache miss should return None"
        mock_redis.get.assert_called_once_with("test_key")
        print(f"✅ Cache miss returns None correctly")

    @patch('llm_cache_redis.get_redis_client')
    def test_cache_hit(self, mock_get_client):
        """Test cache hit returns cached data."""
        mock_redis = Mock()
        cached_data = {"claims": {"claims": []}, "usage": {"total_tokens": 100}}
        mock_redis.get.return_value = json.dumps(cached_data)
        mock_get_client.return_value = mock_redis

        result = get_cached_response("test_key")

        assert result is not None, "Cache hit should return data"
        assert result["claims"] == cached_data["claims"]
        assert result["usage"]["total_tokens"] == 100
        print(f"✅ Cache hit returns correct data")

    @patch('llm_cache_redis.get_redis_client')
    def test_cache_write(self, mock_get_client):
        """Test cache write operation."""
        mock_redis = Mock()
        mock_get_client.return_value = mock_redis

        response_data = {"claims": {"claims": []}, "usage": {"total_tokens": 100}}
        success = cache_response("test_key", response_data)

        assert success is True, "Cache write should succeed"
        mock_redis.setex.assert_called_once()
        call_args = mock_redis.setex.call_args
        assert call_args[0][0] == "test_key"
        assert call_args[0][1] == LLM_CACHE_TTL
        print(f"✅ Cache write succeeds with correct TTL")

    @patch('llm_cache_redis.get_redis_client')
    def test_cache_disabled_returns_none(self, mock_get_client):
        """Test that disabled cache returns None gracefully."""
        with patch('llm_cache_redis.ENABLE_LLM_CACHE', False):
            result = get_cached_response("test_key")
            assert result is None, "Disabled cache should return None"
            print(f"✅ Disabled cache returns None")

    @patch('llm_cache_redis.get_redis_client')
    def test_redis_failure_graceful_degradation(self, mock_get_client):
        """Test graceful degradation when Redis fails."""
        mock_redis = Mock()
        mock_redis.get.side_effect = Exception("Redis connection failed")
        mock_get_client.return_value = mock_redis

        result = get_cached_response("test_key")

        assert result is None, "Redis failure should return None gracefully"
        print(f"✅ Redis failure handled gracefully (cache miss)")

    @patch('llm_cache_redis.get_redis_client')
    def test_cache_write_failure_graceful(self, mock_get_client):
        """Test graceful handling of cache write failures."""
        mock_redis = Mock()
        mock_redis.setex.side_effect = Exception("Redis write failed")
        mock_get_client.return_value = mock_redis

        response_data = {"claims": {"claims": []}}
        success = cache_response("test_key", response_data)

        assert success is False, "Failed cache write should return False"
        print(f"✅ Cache write failure handled gracefully")


class TestCacheStatistics:
    """Test cache statistics and monitoring."""

    @patch('llm_cache_redis.get_redis_client')
    def test_get_cache_stats_success(self, mock_get_client):
        """Test getting cache statistics."""
        mock_redis = Mock()
        mock_redis.scan_iter.return_value = iter([
            "llm_cache:v1:claims:abc123",
            "llm_cache:v1:claims:def456",
            "llm_cache:v1:claims:ghi789"
        ])
        mock_get_client.return_value = mock_redis

        stats = get_cache_stats()

        assert stats["enabled"] is True
        assert stats["cached_entries"] == 3
        assert stats["ttl_hours"] == 24
        print(f"✅ Cache stats returned correctly: {stats['cached_entries']} entries")

    @patch('llm_cache_redis.get_redis_client')
    def test_get_cache_stats_redis_failure(self, mock_get_client):
        """Test cache stats when Redis is unavailable."""
        mock_redis = Mock()
        mock_redis.scan_iter.side_effect = Exception("Redis unavailable")
        mock_get_client.return_value = mock_redis

        stats = get_cache_stats()

        assert stats["enabled"] is True
        assert "error" in stats
        assert stats["cached_entries"] == 0
        print(f"✅ Cache stats handle Redis failure: {stats}")


class TestCacheClearing:
    """Test cache clearing operations."""

    @patch('llm_cache_redis.get_redis_client')
    def test_clear_all_cache(self, mock_get_client):
        """Test clearing all cache entries."""
        mock_redis = Mock()
        mock_redis.scan_iter.return_value = iter([
            "llm_cache:v1:claims:abc123",
            "llm_cache:v1:claims:def456"
        ])
        mock_redis.delete.return_value = 2
        mock_get_client.return_value = mock_redis

        deleted = clear_cache()

        assert deleted == 2, "Should report 2 entries deleted"
        mock_redis.delete.assert_called_once()
        print(f"✅ Clear all cache deleted {deleted} entries")

    @patch('llm_cache_redis.get_redis_client')
    def test_clear_cache_by_pattern(self, mock_get_client):
        """Test clearing cache by pattern."""
        mock_redis = Mock()
        mock_redis.scan_iter.return_value = iter([
            "llm_cache:v1:claims:abc123"
        ])
        mock_redis.delete.return_value = 1
        mock_get_client.return_value = mock_redis

        deleted = clear_cache(pattern="claims:*")

        assert deleted == 1, "Should delete matching entries"
        mock_redis.scan_iter.assert_called_once()
        print(f"✅ Pattern-based cache clear deleted {deleted} entries")

    @patch('llm_cache_redis.get_redis_client')
    def test_clear_empty_cache(self, mock_get_client):
        """Test clearing when cache is empty."""
        mock_redis = Mock()
        mock_redis.scan_iter.return_value = iter([])
        mock_get_client.return_value = mock_redis

        deleted = clear_cache()

        assert deleted == 0, "Should report 0 entries deleted"
        print(f"✅ Clear empty cache returns 0")


class TestCacheConfiguration:
    """Test cache configuration values."""

    def test_cache_enabled_by_default(self):
        """Test that cache is enabled by default."""
        assert ENABLE_LLM_CACHE is True, "Cache should be enabled by default"
        print(f"✅ Cache enabled by default: {ENABLE_LLM_CACHE}")

    def test_cache_ttl_is_24_hours(self):
        """Test that cache TTL is 24 hours (86400 seconds)."""
        assert LLM_CACHE_TTL == 86400, "Cache TTL should be 24 hours"
        print(f"✅ Cache TTL is 24 hours: {LLM_CACHE_TTL} seconds")

    def test_cache_key_prefix(self):
        """Test cache key prefix includes version."""
        assert "llm_cache:" in LLM_CACHE_KEY_PREFIX, "Key prefix should contain 'llm_cache:'"
        assert "v1:" in LLM_CACHE_KEY_PREFIX, "Key prefix should include version"
        print(f"✅ Cache key prefix correct: {LLM_CACHE_KEY_PREFIX}")


def run_all_tests():
    """Run all test classes."""
    print("=" * 60)
    print("LLM Cache Testing Suite")
    print("=" * 60)

    test_classes = [
        TestCacheKeyGeneration,
        TestCacheOperations,
        TestCacheStatistics,
        TestCacheClearing,
        TestCacheConfiguration
    ]

    for test_class in test_classes:
        print(f"\n{test_class.__name__}")
        print("-" * 60)

        test_instance = test_class()
        test_methods = [method for method in dir(test_instance) if method.startswith('test_')]

        for method_name in test_methods:
            try:
                method = getattr(test_instance, method_name)
                method()
            except AssertionError as e:
                print(f"❌ {method_name} FAILED: {e}")
            except Exception as e:
                print(f"❌ {method_name} ERROR: {e}")

    print("\n" + "=" * 60)
    print("All tests completed!")
    print("=" * 60)


if __name__ == "__main__":
    # Run with pytest if available, otherwise run directly
    import sys
    if '--pytest' in sys.argv:
        try:
            import pytest
            # Run with pytest
            pytest.main([__file__, '-v'])
        except ImportError:
            print("pytest not available, running tests directly")
            run_all_tests()
    else:
        # Run directly
        run_all_tests()
