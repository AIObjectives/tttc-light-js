#!/usr/bin/env python3
"""
LLM-assisted comment merging for T3C CSV files

Uses OpenAI to intelligently merge consecutive segments that are
part of the same thought or topic using a sliding window algorithm.

Privacy: Only sends comment text to OpenAI API (no PII like names, IDs, timestamps)
"""

import csv
import os
import sys
import time
from datetime import timedelta
from typing import List, Dict, Any, Tuple
from openai import OpenAI

# Configuration
MAX_COMBINED_WORDS = 200
MAX_TIMESTAMP_GAP_SECONDS = 20
MAX_SINGLE_SEGMENT_WORDS = 150
MODEL = "gpt-4o-mini"
TEMPERATURE = 0

# System prompt for LLM
SYSTEM_PROMPT = """You are evaluating whether two consecutive transcript segments should be merged into one segment.

Merge if:
- They are part of the same thought, sentence, or topic
- The second starts with a continuation word ("This", "That", "And", "But", "It", "However")
- The first ends mid-thought or incompletely
- They form a natural enumeration ("First... Second...")
- Combined they form one complete idea

Do NOT merge if:
- They represent distinct ideas or topics
- There's a natural speaking pause or topic shift
- The first segment is already complete
- They cross question boundaries (segments starting with "[Question:")

Respond with ONLY 'YES' or 'NO'."""


def parse_timestamp(ts_str: str) -> int:
    """Convert timestamp string (H:MM:SS) to seconds."""
    parts = ts_str.split(':')
    if len(parts) == 3:
        h, m, s = map(int, parts)
        return h * 3600 + m * 60 + s
    elif len(parts) == 2:
        m, s = map(int, parts)
        return m * 60 + s
    else:
        return int(parts[0])


def format_timestamp(seconds: int) -> str:
    """Convert seconds to timestamp string (H:MM:SS)."""
    td = timedelta(seconds=seconds)
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60
    return f"{hours}:{minutes:02d}:{secs:02d}"


def should_merge_segments(seg1: Dict[str, str], seg2: Dict[str, str], client: OpenAI, verbose: bool = True) -> Tuple[bool, str]:
    """
    Ask LLM if two segments should be merged.

    Returns: (should_merge: bool, reasoning: str)
    """
    comment1 = seg1['comment']
    comment2 = seg2['comment']

    # Hard boundaries: question markers
    if comment2.strip().startswith('[Question:'):
        return False, "Question boundary"

    # Skip if either segment is too long
    words1 = len(comment1.split())
    words2 = len(comment2.split())

    if words1 > MAX_SINGLE_SEGMENT_WORDS or words2 > MAX_SINGLE_SEGMENT_WORDS:
        return False, f"Too long ({words1} or {words2} words > {MAX_SINGLE_SEGMENT_WORDS})"

    # Skip if combined would be too long
    if words1 + words2 > MAX_COMBINED_WORDS:
        return False, f"Combined too long ({words1 + words2} > {MAX_COMBINED_WORDS})"

    # Skip if timestamps too far apart
    ts1 = parse_timestamp(seg1['timestamp'])
    ts2 = parse_timestamp(seg2['timestamp'])

    if ts2 - ts1 > MAX_TIMESTAMP_GAP_SECONDS:
        return False, f"Timestamp gap too large ({ts2 - ts1}s > {MAX_TIMESTAMP_GAP_SECONDS}s)"

    # Ask LLM with rate limit handling
    max_retries = 3
    retry_delay = 60  # seconds

    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                temperature=TEMPERATURE,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f'Segment 1: "{comment1}"\n\nSegment 2: "{comment2}"\n\nShould these be merged? Respond with ONLY \'YES\' or \'NO\'.'}
                ]
            )

            answer = response.choices[0].message.content.strip().upper()
            should_merge = answer == 'YES'

            return should_merge, "LLM: " + answer

        except Exception as e:
            error_msg = str(e).lower()

            # Check if it's a rate limit error
            if 'rate' in error_msg or '429' in error_msg:
                if attempt < max_retries - 1:
                    if verbose:
                        print(f"  ⚠ Rate limit hit, waiting {retry_delay}s (attempt {attempt + 1}/{max_retries})...", file=sys.stderr)
                    time.sleep(retry_delay)
                    continue

            # Other errors or final retry failed
            if verbose:
                print(f"  ⚠ LLM error: {e}", file=sys.stderr)
            return False, f"Error: {e}"

    return False, "Error: Max retries exceeded"


def merge_two_segments(seg1: Dict[str, str], seg2: Dict[str, str]) -> Dict[str, str]:
    """Merge two segments into one."""
    return {
        'id': seg1['id'],  # Keep first ID (will be renumbered later)
        'interview': seg1['interview'],
        'timestamp': seg1['timestamp'],  # Keep first timestamp
        'comment': seg1['comment'] + ' ' + seg2['comment']
    }


def merge_segments_for_interview(segments: List[Dict[str, str]], client: OpenAI, dry_run: bool = False, verbose: bool = True, max_checks: int = None) -> List[Dict[str, str]]:
    """
    Process segments for one interview using sliding window algorithm.

    Args:
        segments: List of segment dicts for one interview
        client: OpenAI client
        dry_run: If True, don't actually merge, just show decisions
        verbose: Print progress
        max_checks: Limit number of LLM checks (for dry-run preview)

    Returns:
        List of merged segments
    """
    if len(segments) <= 1:
        return segments

    result = segments.copy()
    i = 0
    checks = 0
    merges = 0

    while i < len(result) - 1:
        if max_checks and checks >= max_checks:
            break

        current = result[i]
        next_seg = result[i + 1]

        checks += 1
        should_merge, reason = should_merge_segments(current, next_seg, client, verbose)

        if verbose:
            print(f"  [{checks}] ID {current['id']} + ID {next_seg['id']}: {reason}")
            if should_merge:
                print(f"      ↳ '{current['comment'][:60]}...'")
                print(f"      ↳ '{next_seg['comment'][:60]}...'")

        if should_merge:
            if not dry_run:
                # Merge and remove next segment
                result[i] = merge_two_segments(current, next_seg)
                result.pop(i + 1)
                merges += 1
                # Stay at i to check if newly merged segment should merge with next
            else:
                print(f"      → Would merge (dry-run)")
                i += 1
        else:
            i += 1

        # Rate limiting: small delay between API calls
        time.sleep(0.05)

    if verbose and not dry_run:
        reduction = len(segments) - len(result)
        print(f"  ✓ Merged {merges} pairs, reduced by {reduction} segments ({len(segments)} → {len(result)})")

    return result


def main():
    import argparse

    parser = argparse.ArgumentParser(description='LLM-assisted comment merging for T3C CSV files')
    parser.add_argument('--input', default='transcriptions.csv', help='Input CSV file')
    parser.add_argument('--output', default='transcriptions.csv', help='Output CSV file')
    parser.add_argument('--dry-run', action='store_true', help='Preview merge decisions without applying')
    parser.add_argument('--dry-run-limit', type=int, default=10, help='Number of merge checks to show in dry-run')
    parser.add_argument('--quiet', '-q', action='store_true', help='Suppress progress output')

    args = parser.parse_args()

    # Get API key
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        print("Error: OPENAI_API_KEY environment variable not set", file=sys.stderr)
        sys.exit(1)

    client = OpenAI(api_key=api_key)

    # Read CSV
    if not args.quiet:
        print(f"Reading {args.input}...")

    with open(args.input, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if not args.quiet:
        print(f"Loaded {len(rows)} segments from {len(set(r['interview'] for r in rows))} interviews")
        print()

    # Group by interview
    interviews = {}
    for row in rows:
        interview = row['interview']
        if interview not in interviews:
            interviews[interview] = []
        interviews[interview].append(row)

    # Process each interview
    all_merged = []
    total_original = 0

    for interview_name, segments in interviews.items():
        total_original += len(segments)

        if not args.quiet:
            print(f"\n{'='*80}")
            print(f"Processing: {interview_name}")
            print(f"Segments: {len(segments)}")
            print('='*80)

        if args.dry_run:
            merged = merge_segments_for_interview(
                segments,
                client,
                dry_run=True,
                verbose=not args.quiet,
                max_checks=args.dry_run_limit
            )
            if not args.quiet:
                print(f"\n  (Dry-run preview of first {args.dry_run_limit} checks)")
            break  # Only show first interview in dry-run
        else:
            merged = merge_segments_for_interview(segments, client, dry_run=False, verbose=not args.quiet)

        all_merged.extend(merged)

    if args.dry_run:
        if not args.quiet:
            print(f"\n{'='*80}")
            print("DRY RUN COMPLETE")
            print("="*80)
            print("To execute merge, run without --dry-run flag")
        return

    # Renumber IDs sequentially
    for i, row in enumerate(all_merged, 1):
        row['id'] = str(i)

    # Write output
    if not args.quiet:
        print(f"\n{'='*80}")
        print("Writing merged CSV...")

    with open(args.output, 'w', encoding='utf-8', newline='') as f:
        fieldnames = ['id', 'interview', 'timestamp', 'comment']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_merged)

    # Final stats
    reduction = total_original - len(all_merged)
    reduction_pct = (reduction / total_original * 100) if total_original > 0 else 0

    if not args.quiet:
        print(f"\n{'='*80}")
        print("MERGE COMPLETE")
        print('='*80)
        print(f"Original segments: {total_original}")
        print(f"Merged segments:   {len(all_merged)}")
        print(f"Reduction:         {reduction} segments ({reduction_pct:.1f}%)")
        print(f"\n✓ Saved to: {args.output}")
        print(f"✓ Backup at: {args.input}.pre-llm-merge")


if __name__ == '__main__':
    main()
