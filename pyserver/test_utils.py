"""
Tests for utility functions in main.py

This file contains unit tests for helper functions and utilities that don't
fit into other test categories.
"""

import pytest
from main import extract_token_usage


class TestTokenUsageExtraction:
    """Test the extract_token_usage() helper function."""

    def test_extract_from_dict_format(self):
        """Test extracting tokens from dict format (from cache)."""
        usage = {
            "prompt_tokens": 100,
            "completion_tokens": 50,
            "total_tokens": 150
        }

        prompt, completion, total = extract_token_usage(usage)

        assert prompt == 100
        assert completion == 50
        assert total == 150
        print("✅ Successfully extracted tokens from dict format")

    def test_extract_from_object_format(self):
        """Test extracting tokens from object format (from OpenAI API)."""
        # Mock OpenAI usage object
        class MockUsage:
            prompt_tokens = 200
            completion_tokens = 100
            total_tokens = 300

        usage = MockUsage()

        prompt, completion, total = extract_token_usage(usage)

        assert prompt == 200
        assert completion == 100
        assert total == 300
        print("✅ Successfully extracted tokens from object format")

    def test_extract_with_none_usage(self):
        """Test extracting tokens when usage is None."""
        prompt, completion, total = extract_token_usage(None)

        assert prompt == 0
        assert completion == 0
        assert total == 0
        print("✅ Safely handled None usage")

    def test_extract_with_missing_fields_dict(self):
        """Test extracting tokens from dict with missing fields."""
        usage = {
            "prompt_tokens": 100,
            # Missing completion_tokens and total_tokens
        }

        prompt, completion, total = extract_token_usage(usage)

        assert prompt == 100
        assert completion == 0  # Default value
        assert total == 0       # Default value
        print("✅ Safely handled dict with missing fields")

    def test_extract_with_missing_fields_object(self):
        """Test extracting tokens from object with missing attributes."""
        class PartialUsage:
            prompt_tokens = 150
            # Missing completion_tokens and total_tokens

        usage = PartialUsage()

        prompt, completion, total = extract_token_usage(usage)

        assert prompt == 150
        assert completion == 0  # Default value
        assert total == 0       # Default value
        print("✅ Safely handled object with missing attributes")

    def test_extract_with_empty_dict(self):
        """Test extracting tokens from empty dict."""
        usage = {}

        prompt, completion, total = extract_token_usage(usage)

        assert prompt == 0
        assert completion == 0
        assert total == 0
        print("✅ Safely handled empty dict")

    def test_extract_preserves_zero_values(self):
        """Test that explicit zero values are preserved (not treated as missing)."""
        usage = {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0
        }

        prompt, completion, total = extract_token_usage(usage)

        assert prompt == 0
        assert completion == 0
        assert total == 0
        print("✅ Correctly preserved explicit zero values")
