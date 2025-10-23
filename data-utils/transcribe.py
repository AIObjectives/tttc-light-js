#!/usr/bin/env python3
"""
Non-interactive video transcription with natural speech segments.

Improved version of csv_natural_segments.py with:
- CLI arguments instead of interactive prompts
- Environment variable support for API keys
- Automatic segment merging
- Progress tracking
- Cost estimation

Usage:
    # Basic usage (API key from environment)
    export OPENAI_API_KEY="sk-..."
    python transcribe.py chunks/*.mp3 --output transcriptions.csv

    # With all options
    python transcribe.py chunks/*.mp3 \
        --output transcriptions.csv \
        --language en \
        --min-words 10

    # Show cost estimate only
    python transcribe.py chunks/*.mp3 --estimate-cost
"""

import argparse
import csv
import glob
import os
import sys
from datetime import timedelta
from typing import List, Dict, Any
from openai import OpenAI

# Constants
CHUNK_DURATION_SECONDS = 14 * 60  # 14 minutes per chunk (Whisper API limit is 15 min)
WHISPER_COST_PER_MINUTE = 0.006  # OpenAI Whisper API pricing


def estimate_duration(mp3_files: List[str]) -> float:
    """Estimate total duration using ffprobe."""
    import subprocess
    total_seconds = 0
    failed_files = []

    for mp3_file in mp3_files:
        try:
            # Use ffprobe for structured output
            result = subprocess.run(
                ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                 '-of', 'default=noprint_wrappers=1:nokey=1', mp3_file],
                capture_output=True,
                text=True,
                check=True
            )
            duration = float(result.stdout.strip())
            total_seconds += duration
        except subprocess.CalledProcessError as e:
            failed_files.append((mp3_file, f"ffprobe failed: {e}"))
        except ValueError as e:
            failed_files.append((mp3_file, f"Invalid duration: {e}"))
        except Exception as e:
            failed_files.append((mp3_file, f"Unknown error: {e}"))

    if failed_files:
        print("Warning: Could not determine duration for some files:", file=sys.stderr)
        for filename, error in failed_files:
            print(f"  - {os.path.basename(filename)}: {error}", file=sys.stderr)

    return total_seconds


def transcribe_files(mp3_files: List[str], api_key: str, language: str = 'en', verbose: bool = True) -> tuple[List[Dict[str, Any]], List[tuple[str, str]]]:
    """
    Transcribe MP3 files using Whisper API with natural segments.

    Returns tuple of (segments, failed_files).
    - segments: List of transcribed segments with natural speech boundaries
    - failed_files: List of (filename, error_message) tuples for files that failed
    """
    client = OpenAI(api_key=api_key)
    all_segments = []
    failed_files = []
    current_interview = None
    chunk_offset_seconds = 0

    for idx, filename in enumerate(mp3_files, 1):
        if verbose:
            print(f"[{idx}/{len(mp3_files)}] Processing: {os.path.basename(filename)}")

        # Extract interview name
        base_name = os.path.basename(filename).replace('.mp3', '')
        if '_chunk_' in base_name:
            interview_base, chunk_num = base_name.rsplit('_chunk_', 1)
            chunk_num = int(chunk_num)
        else:
            interview_base = base_name
            chunk_num = 1

        # Reset offset for new interview
        if current_interview != interview_base:
            if verbose and current_interview:
                print(f"  → Completed {current_interview}: {len([s for s in all_segments if s['interview'] == current_interview])} segments")
            current_interview = interview_base
            chunk_offset_seconds = 0

        # Transcribe
        try:
            with open(filename, 'rb') as audio_file:
                transcription = client.audio.transcriptions.create(
                    model='whisper-1',
                    file=audio_file,
                    response_format='verbose_json',
                    language=language
                )
        except Exception as e:
            error_msg = str(e)
            print(f"  ✗ Error transcribing {os.path.basename(filename)}: {error_msg}", file=sys.stderr)
            failed_files.append((filename, error_msg))
            continue

        segments = transcription.segments
        if not segments:
            warning_msg = "No segments found in transcription"
            print(f"  ⚠ {warning_msg}", file=sys.stderr)
            failed_files.append((filename, warning_msg))
            continue

        if verbose:
            print(f"  → {len(segments)} natural segments")

        # Process segments
        for seg in segments:
            actual_timestamp_seconds = chunk_offset_seconds + seg.start
            all_segments.append({
                'interview': interview_base,
                'timestamp': timedelta(seconds=int(actual_timestamp_seconds)),
                'text': seg.text.strip()
            })

        # Update offset for next chunk
        if '_chunk_' in base_name:
            chunk_offset_seconds = (chunk_num - 1) * CHUNK_DURATION_SECONDS + max(s.end for s in segments)

    return all_segments, failed_files


def merge_segments(segments: List[Dict[str, Any]], min_words: int = 10) -> List[Dict[str, Any]]:
    """
    Merge overly-granular segments using smart rules.

    Rules:
    - Merge segments < min_words with previous
    - Merge if starts with lowercase (continuation)
    - Merge if previous doesn't end with sentence punctuation
    """
    if not segments:
        return []

    def word_count(text):
        return len(text.split())

    def ends_with_sentence(text):
        text = text.strip().rstrip('"').rstrip("'")
        return text.endswith(('.', '!', '?'))

    def starts_with_lowercase(text):
        text = text.strip().lstrip('"').lstrip("'")
        return text and text[0].islower()

    merged = []
    current = None

    for seg in segments:
        if current is None:
            current = seg.copy()
        else:
            # Check if should merge
            should_merge = (
                seg['interview'] == current['interview'] and (
                    word_count(seg['text']) < min_words or
                    starts_with_lowercase(seg['text']) or
                    not ends_with_sentence(current['text'])
                )
            )

            if should_merge:
                # Merge text
                current['text'] = current['text'].rstrip() + ' ' + seg['text'].lstrip()
            else:
                # Save current and start new
                merged.append(current)
                current = seg.copy()

    if current:
        merged.append(current)

    return merged


def write_csv(segments: List[Dict[str, Any]], output_file: str, format: str = 't3c', start_id: int = 1) -> None:
    """Write segments to CSV in specified format."""

    if format == 't3c':
        # T3C format: id, interview, timestamp, comment
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['id', 'interview', 'timestamp', 'comment'])
            writer.writeheader()
            for idx, seg in enumerate(segments, start_id):
                writer.writerow({
                    'id': idx,
                    'interview': seg['interview'],
                    'timestamp': str(seg['timestamp']),
                    'comment': seg['text']
                })
    else:
        # Detailed format: includes more metadata
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['comment-id', 'interview', 'timestamp', 'comment-body'])
            writer.writeheader()
            for idx, seg in enumerate(segments, start_id):
                writer.writerow({
                    'comment-id': idx,
                    'interview': seg['interview'],
                    'timestamp': str(seg['timestamp']),
                    'comment-body': seg['text']
                })


def main():
    parser = argparse.ArgumentParser(
        description='Transcribe videos with natural speech segments',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage with API key from environment
  export OPENAI_API_KEY="sk-..."
  python transcribe.py chunks/*.mp3 --output transcriptions.csv

  # With all options
  python transcribe.py chunks/*.mp3 \\
      --output transcriptions.csv \\
      --language en \\
      --min-words 10

  # Estimate cost before running
  python transcribe.py chunks/*.mp3 --estimate-cost
        """
    )

    parser.add_argument(
        'files',
        nargs='+',
        help='MP3 files to transcribe (supports glob patterns)'
    )
    parser.add_argument(
        '--output', '-o',
        default='transcriptions.csv',
        help='Output CSV file (default: transcriptions.csv)'
    )
    parser.add_argument(
        '--language', '-l',
        default='en',
        help='Language code (default: en)'
    )
    parser.add_argument(
        '--no-merge-segments',
        action='store_true',
        help='Disable segment merging (merging is enabled by default)'
    )
    parser.add_argument(
        '--min-words',
        type=int,
        default=10,
        help='Minimum words per segment when merging (default: 10)'
    )
    parser.add_argument(
        '--format',
        choices=['t3c', 'detailed'],
        default='t3c',
        help='Output format (default: t3c)'
    )
    parser.add_argument(
        '--start-id',
        type=int,
        default=1,
        help='Starting ID for segments (useful for appending to existing dataset, default: 1)'
    )
    parser.add_argument(
        '--estimate-cost',
        action='store_true',
        help='Estimate cost and exit (no transcription)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be transcribed without actually transcribing'
    )
    parser.add_argument(
        '--quiet', '-q',
        action='store_true',
        help='Suppress progress output'
    )

    args = parser.parse_args()

    # Expand glob patterns
    mp3_files = []
    for pattern in args.files:
        matches = glob.glob(pattern)
        if matches:
            mp3_files.extend(matches)
        elif os.path.exists(pattern):
            mp3_files.append(pattern)

    if not mp3_files:
        print("Error: No MP3 files found", file=sys.stderr)
        sys.exit(1)

    mp3_files.sort()

    # Validate API key (from environment only for security)
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key and not args.estimate_cost and not args.dry_run:
        print("Error: OpenAI API key required", file=sys.stderr)
        print("Set OPENAI_API_KEY environment variable", file=sys.stderr)
        sys.exit(1)

    # Dry run mode
    if args.dry_run:
        print("=== DRY RUN ===")
        print(f"Files to transcribe: {len(mp3_files)}")
        print("\nFiles:")
        for f in mp3_files[:10]:
            print(f"  - {os.path.basename(f)}")
        if len(mp3_files) > 10:
            print(f"  ... and {len(mp3_files) - 10} more")

        print("\nEstimating duration and cost...")
        total_seconds = estimate_duration(mp3_files)
        total_minutes = total_seconds / 60
        cost = total_minutes * WHISPER_COST_PER_MINUTE

        print(f"\nTotal duration: {int(total_minutes)} minutes ({int(total_seconds)} seconds)")
        print(f"Estimated cost: ${cost:.2f}")
        print(f"Starting ID: {args.start_id}")
        print(f"Estimated final ID: {args.start_id + len(mp3_files) * 5 - 1} (rough estimate)")

        print("\nTo run for real:")
        print(f"  python transcribe.py {' '.join(args.files)} --output {args.output}")
        if args.start_id != 1:
            print(f"    --start-id {args.start_id}")
        return

    # Estimate cost
    if args.estimate_cost:
        print("Estimating cost...")
        total_seconds = estimate_duration(mp3_files)
        total_minutes = total_seconds / 60
        cost = total_minutes * WHISPER_COST_PER_MINUTE

        print(f"\nFiles: {len(mp3_files)}")
        print(f"Duration: {int(total_minutes)} minutes ({int(total_seconds)} seconds)")
        print(f"Estimated cost: ${cost:.2f}")
        return

    # Transcribe
    merge_segments_enabled = not args.no_merge_segments
    if not args.quiet:
        print(f"Transcribing {len(mp3_files)} files...")
        print(f"Language: {args.language}")
        print(f"Merge segments: {merge_segments_enabled}")
        if merge_segments_enabled:
            print(f"Min words: {args.min_words}")
        print()

    segments, failed_files = transcribe_files(mp3_files, api_key, args.language, verbose=not args.quiet)

    if not args.quiet:
        print(f"\nTranscription complete: {len(segments)} segments")
        if failed_files:
            print(f"⚠ {len(failed_files)} files failed (see below)")

    # Merge if requested
    if merge_segments_enabled:
        original_count = len(segments)
        segments = merge_segments(segments, args.min_words)
        if not args.quiet:
            print(f"Merged segments: {len(segments)} (reduced by {original_count - len(segments)})")

    # Write output even if some files failed
    if segments:
        write_csv(segments, args.output, args.format, args.start_id)

        if not args.quiet:
            print(f"\n✓ Saved to: {args.output}")
            print(f"  Format: {args.format}")
            print(f"  Segments: {len(segments)}")
            print(f"  ID range: {args.start_id} - {args.start_id + len(segments) - 1}")
    else:
        print("\n✗ No segments to save (all files failed)", file=sys.stderr)

    # Report failed files
    if failed_files:
        print(f"\n⚠ Failed files ({len(failed_files)}):", file=sys.stderr)
        for filename, error in failed_files:
            print(f"  - {os.path.basename(filename)}: {error}", file=sys.stderr)
        sys.exit(1)  # Exit with error if any files failed


if __name__ == '__main__':
    main()
