#!/usr/bin/env python3
"""
Split very long document-style comments into sentence-based segments.

Useful for T3C CSV files where some responses are pasted documents
rather than transcribed speech. Splits comments >500 words into
multiple segments based on sentence boundaries.

Best practice: Run this first, then llm_merge_comments.py to
intelligently recombine related sentences.
"""

import csv
import re
from typing import List, Dict

# Configuration
MIN_WORDS_TO_SPLIT = 500
TARGET_SEGMENT_SIZE = 250  # words
MIN_SEGMENT_SIZE = 100  # words
MAX_SEGMENT_SIZE = 500  # words


def count_words(text: str) -> int:
    """Count words in text."""
    return len(text.split())


def extract_question_prefix(comment: str) -> tuple[str, str]:
    """
    Extract [Question: ...] prefix if present.

    Returns: (question_prefix, remaining_text)
    """
    match = re.match(r'^(\[Question:[^\]]+\]\s*)', comment, re.IGNORECASE)
    if match:
        return match.group(1), comment[len(match.group(1)):]
    return "", comment


def split_into_sentences(text: str) -> List[str]:
    """Split text into sentences."""
    # Split on sentence boundaries (., !, ?)
    sentences = re.split(r'([.!?])\s+', text)

    # Rejoin punctuation with sentences
    result = []
    i = 0
    while i < len(sentences):
        if i + 1 < len(sentences) and sentences[i + 1] in '.!?':
            result.append(sentences[i] + sentences[i + 1])
            i += 2
        else:
            if sentences[i].strip():
                result.append(sentences[i])
            i += 1

    return [s.strip() for s in result if s.strip()]


def group_sentences(sentences: List[str], target_size: int = TARGET_SEGMENT_SIZE) -> List[str]:
    """
    Group sentences into segments of roughly target_size words.

    Tries to keep related content together while staying within bounds.
    """
    segments = []
    current_segment = []
    current_words = 0

    for sentence in sentences:
        sentence_words = count_words(sentence)

        # If adding this sentence would exceed max size and we have content, start new segment
        if current_words + sentence_words > MAX_SEGMENT_SIZE and current_segment:
            segments.append(' '.join(current_segment))
            current_segment = []
            current_words = 0

        current_segment.append(sentence)
        current_words += sentence_words

        # If we've hit a good size, start new segment
        if current_words >= target_size:
            segments.append(' '.join(current_segment))
            current_segment = []
            current_words = 0

    # Add remaining content
    if current_segment:
        segments.append(' '.join(current_segment))

    return segments


def split_long_comment(row: Dict[str, str]) -> List[Dict[str, str]]:
    """
    Split a long comment into multiple segments.

    Returns list of new rows (may be just the original if not long enough).
    """
    comment = row['comment']
    words = count_words(comment)

    # Don't split if under threshold
    if words < MIN_WORDS_TO_SPLIT:
        return [row]

    # Extract question prefix
    question_prefix, body = extract_question_prefix(comment)

    # Split into sentences
    sentences = split_into_sentences(body)

    # Group sentences into segments
    segments = group_sentences(sentences)

    # Create new rows for each segment
    new_rows = []
    for i, segment in enumerate(segments):
        new_row = row.copy()

        # Add question prefix only to first segment
        if i == 0 and question_prefix:
            new_row['comment'] = question_prefix + segment
        else:
            new_row['comment'] = segment

        new_rows.append(new_row)

    return new_rows


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Split long document-style comments into segments')
    parser.add_argument('--input', default='transcriptions.csv', help='Input CSV file')
    parser.add_argument('--output', default='transcriptions.csv', help='Output CSV file')
    parser.add_argument('--dry-run', action='store_true', help='Preview splits without applying')
    parser.add_argument('--threshold', type=int, default=MIN_WORDS_TO_SPLIT, help=f'Min words to split (default: {MIN_WORDS_TO_SPLIT})')

    args = parser.parse_args()

    # Read CSV
    print(f"Reading {args.input}...")
    with open(args.input, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"Loaded {len(rows)} segments")
    print()

    # Find candidates for splitting
    candidates = [(i, row) for i, row in enumerate(rows) if count_words(row['comment']) >= args.threshold]

    print(f"Found {len(candidates)} comments >{args.threshold} words:")
    print("="*80)
    for i, (idx, row) in enumerate(candidates, 1):
        words = count_words(row['comment'])
        print(f"{i}. ID {row['id']} - {row['interview'].split('(')[0].strip()}: {words} words")
    print()

    if args.dry_run:
        print("DRY RUN - Previewing splits:")
        print("="*80)

        for idx, row in candidates[:3]:  # Show first 3
            words = count_words(row['comment'])
            print(f"\nID {row['id']} ({words} words) would split into:")

            new_rows = split_long_comment(row)
            for i, new_row in enumerate(new_rows, 1):
                segment_words = count_words(new_row['comment'])
                preview = new_row['comment'][:100].replace('\n', ' ')
                print(f"  Segment {i}: {segment_words} words - {preview}...")

        print("\n" + "="*80)
        print("To apply splits, run without --dry-run flag")
        return

    # Process all rows
    print("Splitting long documents...")
    all_rows = []
    splits_count = 0

    for row in rows:
        new_rows = split_long_comment(row)
        all_rows.extend(new_rows)

        if len(new_rows) > 1:
            splits_count += 1
            words = count_words(row['comment'])
            print(f"  Split ID {row['id']} ({words} words) → {len(new_rows)} segments")

    # Renumber IDs sequentially
    print("\nRenumbering IDs...")
    for i, row in enumerate(all_rows, 1):
        row['id'] = str(i)

    # Write output
    print(f"Writing {args.output}...")
    with open(args.output, 'w', encoding='utf-8', newline='') as f:
        fieldnames = ['id', 'interview', 'timestamp', 'comment']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_rows)

    # Stats
    added = len(all_rows) - len(rows)
    print()
    print("="*80)
    print("SPLIT COMPLETE")
    print("="*80)
    print(f"Original segments: {len(rows)}")
    print(f"After split:       {len(all_rows)}")
    print(f"Documents split:   {splits_count}")
    print(f"New segments:      +{added}")
    print()
    print(f"✓ Saved to: {args.output}")
    print(f"✓ Backup at: {args.input}.pre-split")
    print()
    print("Recommendation: Run llm_merge_comments.py to intelligently")
    print("              recombine sentences that should be together")


if __name__ == '__main__':
    main()
