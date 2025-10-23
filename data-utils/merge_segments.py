#!/usr/bin/env python3
"""
Merge overly-granular transcript segments using simple, safe rules.
Does NOT change any transcription text - only recombines segments.

Rules for merging:
1. Merge very short segments (< 10 words) with previous segment
2. Merge segments that start with lowercase (continuation)
3. Merge if previous segment doesn't end with sentence-ending punctuation
4. Keep timestamp of first segment in merged group
"""

import csv
import sys
from datetime import timedelta
from typing import Optional

def word_count(text: str) -> int:
    """Count words in text"""
    return len(text.split())

def ends_with_sentence(text: str) -> bool:
    """Check if text ends with sentence-ending punctuation"""
    text = text.strip().rstrip('"').rstrip("'")
    return text.endswith(('.', '!', '?'))

def starts_with_lowercase(text: str) -> bool:
    """Check if text starts with lowercase (likely continuation)"""
    text = text.strip().lstrip('"').lstrip("'")
    return text and text[0].islower()

def should_merge_with_previous(current_text: str, previous_text: Optional[str], min_words: int = 10) -> bool:
    """
    Determine if current segment should merge with previous.

    Args:
        current_text: Text of current segment
        previous_text: Text of previous segment
        min_words: Minimum word count threshold

    Returns:
        bool: True if should merge
    """
    # Rule 1: Very short segments
    if word_count(current_text) < min_words:
        return True

    # Rule 2: Starts with lowercase (continuation)
    if starts_with_lowercase(current_text):
        return True

    # Rule 3: Previous doesn't end with sentence punctuation
    if previous_text and not ends_with_sentence(previous_text):
        return True

    return False

def merge_segments(input_csv: str, output_csv: str, min_words: int = 10, verbose: bool = True) -> None:
    """
    Merge segments based on simple rules without changing transcription.

    Args:
        input_csv: Path to input CSV
        output_csv: Path to output CSV
        min_words: Minimum words to keep segment separate
        verbose: Print merge statistics
    """
    with open(input_csv, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    merged_rows = []
    current_merged = None
    merge_count = 0

    for i, row in enumerate(rows):
        if current_merged is None:
            # Start a new merged segment
            current_merged = {
                'comment-id': row['comment-id'],
                'interview': row['interview'],
                'timestamp': row['timestamp'],
                'comment-body': row['comment-body'],
                'original_ids': [row['comment-id']]
            }
        else:
            # Check if we should merge with previous
            previous_text = current_merged['comment-body']
            current_text = row['comment-body']

            # Only merge if same interview
            if row['interview'] == current_merged['interview'] and \
               should_merge_with_previous(current_text, previous_text, min_words):
                # Merge: append text with space
                current_merged['comment-body'] = (
                    current_merged['comment-body'].rstrip() + ' ' +
                    current_text.lstrip()
                )
                current_merged['original_ids'].append(row['comment-id'])
                merge_count += 1
            else:
                # Don't merge - save current and start new
                merged_rows.append({
                    'comment-id': current_merged['comment-id'],
                    'interview': current_merged['interview'],
                    'timestamp': current_merged['timestamp'],
                    'comment-body': current_merged['comment-body']
                })
                current_merged = {
                    'comment-id': row['comment-id'],
                    'interview': row['interview'],
                    'timestamp': row['timestamp'],
                    'comment-body': row['comment-body'],
                    'original_ids': [row['comment-id']]
                }

    # Don't forget the last merged segment
    if current_merged:
        merged_rows.append({
            'comment-id': current_merged['comment-id'],
            'interview': current_merged['interview'],
            'timestamp': current_merged['timestamp'],
            'comment-body': current_merged['comment-body']
        })

    # Renumber comment IDs
    for i, row in enumerate(merged_rows, 1):
        row['comment-id'] = i

    # Write output
    with open(output_csv, 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['comment-id', 'interview', 'timestamp', 'comment-body']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(merged_rows)

    if verbose:
        print(f"\n{'='*60}")
        print(f"Segment Merging Complete")
        print(f"{'='*60}")
        print(f"Input segments:  {len(rows)}")
        print(f"Output segments: {len(merged_rows)}")
        print(f"Merged:          {len(rows) - len(merged_rows)} segments")
        print(f"Reduction:       {((len(rows) - len(merged_rows)) / len(rows) * 100):.1f}%")
        print(f"{'='*60}")
        print(f"\nNo transcription text was changed - only recombined.")
        print(f"Saved to: {output_csv}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python merge_segments.py <input_csv> [output_csv] [min_words]")
        print()
        print("Arguments:")
        print("  input_csv   - CSV file to process")
        print("  output_csv  - Output file (default: input_merged.csv)")
        print("  min_words   - Minimum words per segment (default: 10)")
        print()
        print("Example:")
        print("  python merge_segments.py transcriptions.csv")
        print("  python merge_segments.py transcriptions.csv merged.csv 15")
        sys.exit(1)

    input_file = sys.argv[1]

    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    else:
        # Default: add _merged before .csv
        output_file = input_file.replace('.csv', '_merged.csv')

    min_words = int(sys.argv[3]) if len(sys.argv) > 3 else 10

    merge_segments(input_file, output_file, min_words=min_words)
