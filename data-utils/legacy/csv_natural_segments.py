import os
import glob
import csv
from openai import OpenAI
from datetime import timedelta

def main(language, api_key, output_filename):
    """
    Process MP3 chunks and create a T3C-compatible CSV using Whisper's natural
    speech segments (sentences/phrases) instead of arbitrary time buckets.

    This preserves natural speech boundaries which is better for claim extraction.
    """
    client = OpenAI(api_key=api_key)

    # List to hold CSV rows and an initial comment_id
    csv_rows = []
    comment_id = 1
    chunk_offset_seconds = 0  # Track time offset across chunks

    # Get all mp3 files in the current directory
    mp3_files = glob.glob("*.mp3")
    mp3_files.sort()

    if not mp3_files:
        print("No mp3 files found in the current directory.")
        return

    # Track which interview we're processing (for multi-chunk handling)
    current_interview = None

    for filename in mp3_files:
        print(f"\nProcessing file: {filename}")

        # Extract interview name (remove _chunk_N suffix if present)
        interview_name = filename.replace('.mp3', '')
        if '_chunk_' in interview_name:
            base_name = interview_name.rsplit('_chunk_', 1)[0]
            chunk_number = int(interview_name.rsplit('_chunk_', 1)[1])
        else:
            base_name = interview_name
            chunk_number = 1

        # If this is a new interview, reset chunk offset
        if current_interview != base_name:
            print(f"Starting new interview: {base_name}")
            current_interview = base_name
            chunk_offset_seconds = 0

        # Transcribe the file
        try:
            with open(filename, "rb") as audio_file:
                transcription = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="verbose_json",  # Get detailed segments
                    language=language
                )
        except Exception as e:
            print(f"Error transcribing {filename}: {e}")
            continue

        # Get natural speech segments from Whisper
        segments = transcription.segments
        if not segments:
            print(f"No transcription segments found for {filename}.")
            continue

        print(f"Found {len(segments)} natural speech segments")

        # Process each natural segment
        for seg in segments:
            # Calculate actual timestamp in original video (accounting for chunks)
            actual_timestamp_seconds = chunk_offset_seconds + seg.start

            row = {
                "comment-id": comment_id,
                "interview": base_name,
                "timestamp": timedelta(seconds=int(actual_timestamp_seconds)),
                "comment-body": seg.text.strip()
            }

            csv_rows.append(row)
            comment_id += 1

        # Update chunk offset for next chunk of same interview
        # Chunks are 14 minutes (840 seconds) each
        if chunk_number > 1 or '_chunk_' in filename:
            chunk_offset_seconds = (chunk_number - 1) * 840 + max(seg.end for seg in segments)

    # Write CSV
    fieldnames = ["comment-id", "interview", "timestamp", "comment-body"]

    with open(output_filename, mode="w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        for row in csv_rows:
            writer.writerow(row)

    print(f"\n{'='*60}")
    print(f"CSV file '{output_filename}' created successfully!")
    print(f"Total segments: {len(csv_rows)}")
    print(f"Using natural speech boundaries from Whisper")
    print(f"{'='*60}")


if __name__ == "__main__":
    print("="*60)
    print("T3C Transcription - Natural Speech Segments")
    print("Using Whisper's natural sentence/phrase boundaries")
    print("="*60)
    print()

    language = input("Enter the language of the files to process, as a " +
                     "two-letter abbreviation (e.g. 'en', 'es', 'fr'): ")
    api_key = input("Enter your OpenAI API key: ")
    output_file = input("Enter the filename to use for the output file (ending in .csv): ")

    if not output_file:
        output_file = 'transcriptions_natural.csv'

    main(language, api_key, output_file)
