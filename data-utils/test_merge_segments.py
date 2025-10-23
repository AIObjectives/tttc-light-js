#!/usr/bin/env python3
"""
Tests for segment merging logic.

Run with: python -m pytest test_merge_segments.py -v
Or simply: python test_merge_segments.py
"""

import sys
from merge_segments import (
    word_count,
    ends_with_sentence,
    starts_with_lowercase,
    should_merge_with_previous,
    merge_segments
)


def test_word_count():
    """Test word counting logic."""
    assert word_count("hello world") == 2
    assert word_count("") == 0
    assert word_count("one") == 1
    assert word_count("  multiple   spaces  ") == 2
    assert word_count("Hello, world! How are you?") == 5


def test_ends_with_sentence():
    """Test sentence ending detection."""
    assert ends_with_sentence("Hello.") == True
    assert ends_with_sentence("Hello!") == True
    assert ends_with_sentence("Hello?") == True
    assert ends_with_sentence("Hello") == False
    assert ends_with_sentence("Hello,") == False
    # Should handle trailing quotes
    assert ends_with_sentence('Hello."') == True
    assert ends_with_sentence("Hello.'") == True
    # Should handle whitespace
    assert ends_with_sentence("Hello.  ") == True


def test_starts_with_lowercase():
    """Test lowercase start detection."""
    assert starts_with_lowercase("hello") == True
    assert starts_with_lowercase("Hello") == False
    assert not starts_with_lowercase("")  # Returns empty string (falsy)
    # Should handle leading quotes
    assert starts_with_lowercase('"hello') == True
    assert starts_with_lowercase("'hello") == True
    # Should handle whitespace
    assert starts_with_lowercase("  hello") == True
    # Should handle numbers (not lowercase)
    assert starts_with_lowercase("123") == False


def test_should_merge_short_segments():
    """Short segments should merge with previous."""
    # < 10 words should merge
    assert should_merge_with_previous("short text", "Previous segment.", min_words=10) == True
    # >= 10 words should not merge (if other conditions don't apply)
    long_text = "This is a longer segment with more than ten words in it"
    assert should_merge_with_previous(long_text, "Previous segment.", min_words=10) == False


def test_should_merge_lowercase_start():
    """Segments starting with lowercase should merge."""
    # Long enough segment (>10 words) but starts with lowercase
    lowercase_text = "and then this happened to me during my time working there"
    assert should_merge_with_previous(lowercase_text, "Previous segment.", min_words=10) == True

    # Long enough segment (>10 words) starts with uppercase, previous complete
    uppercase_text = "And then this happened to me during my time working there"
    assert should_merge_with_previous(uppercase_text, "Previous segment.", min_words=10) == False


def test_should_merge_incomplete_previous():
    """Should merge if previous doesn't end with sentence punctuation."""
    # Previous incomplete
    assert should_merge_with_previous("Next segment", "Previous without ending", min_words=10) == True
    # Previous complete
    long_next = "This is a long enough segment with more than ten words"
    assert should_merge_with_previous(long_next, "Previous complete.", min_words=10) == False


def test_merge_segments_basic():
    """Test basic segment merging."""
    segments = [
        {'comment-id': '1', 'interview': 'Ann', 'timestamp': '0:00', 'comment-body': 'Hello world'},
        {'comment-id': '2', 'interview': 'Ann', 'timestamp': '0:05', 'comment-body': 'program.'},  # < 10 words
    ]

    import tempfile
    import csv

    # Create temp input file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['comment-id', 'interview', 'timestamp', 'comment-body'])
        writer.writeheader()
        writer.writerows(segments)
        input_file = f.name

    # Create temp output file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
        output_file = f.name

    # Merge
    merge_segments(input_file, output_file, min_words=10, verbose=False)

    # Read result
    with open(output_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        result = list(reader)

    # Verify
    assert len(result) == 1, "Should merge two short segments into one"
    assert 'Hello world program.' in result[0]['comment-body']
    assert result[0]['comment-id'] == '1', "Should keep first ID"
    assert result[0]['timestamp'] == '0:00', "Should keep first timestamp"

    # Cleanup
    import os
    os.unlink(input_file)
    os.unlink(output_file)


def test_merge_segments_different_interviews():
    """Segments from different interviews should not merge."""
    segments = [
        {'comment-id': '1', 'interview': 'Ann', 'timestamp': '0:00', 'comment-body': 'Hello'},
        {'comment-id': '2', 'interview': 'Bob', 'timestamp': '0:05', 'comment-body': 'world'},
    ]

    import tempfile
    import csv

    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['comment-id', 'interview', 'timestamp', 'comment-body'])
        writer.writeheader()
        writer.writerows(segments)
        input_file = f.name

    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
        output_file = f.name

    merge_segments(input_file, output_file, min_words=10, verbose=False)

    with open(output_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        result = list(reader)

    assert len(result) == 2, "Different interviews should not merge"

    import os
    os.unlink(input_file)
    os.unlink(output_file)


def test_merge_segments_lowercase_continuation():
    """Segments starting lowercase should merge even if long enough."""
    segments = [
        {'comment-id': '1', 'interview': 'Ann', 'timestamp': '0:00', 'comment-body': 'I served in the'},
        {'comment-id': '2', 'interview': 'Ann', 'timestamp': '0:05', 'comment-body': 'federal government for many years doing important work.'},
    ]

    import tempfile
    import csv

    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['comment-id', 'interview', 'timestamp', 'comment-body'])
        writer.writeheader()
        writer.writerows(segments)
        input_file = f.name

    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
        output_file = f.name

    merge_segments(input_file, output_file, min_words=10, verbose=False)

    with open(output_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        result = list(reader)

    assert len(result) == 1, "Lowercase continuation should merge"
    assert 'I served in the federal government' in result[0]['comment-body']

    import os
    os.unlink(input_file)
    os.unlink(output_file)


def run_tests():
    """Run all tests manually (without pytest)."""
    tests = [
        ("word_count", test_word_count),
        ("ends_with_sentence", test_ends_with_sentence),
        ("starts_with_lowercase", test_starts_with_lowercase),
        ("should_merge_short_segments", test_should_merge_short_segments),
        ("should_merge_lowercase_start", test_should_merge_lowercase_start),
        ("should_merge_incomplete_previous", test_should_merge_incomplete_previous),
        ("merge_segments_basic", test_merge_segments_basic),
        ("merge_segments_different_interviews", test_merge_segments_different_interviews),
        ("merge_segments_lowercase_continuation", test_merge_segments_lowercase_continuation),
    ]

    print(f"Running {len(tests)} tests...")
    print("=" * 60)

    passed = 0
    failed = 0

    for name, test_func in tests:
        try:
            test_func()
            print(f"✓ {name}")
            passed += 1
        except AssertionError as e:
            print(f"✗ {name}: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ {name}: ERROR: {e}")
            failed += 1

    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")

    return failed == 0


if __name__ == "__main__":
    # Can be run directly or with pytest
    success = run_tests()
    sys.exit(0 if success else 1)
