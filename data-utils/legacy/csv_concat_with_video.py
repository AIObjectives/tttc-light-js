import os
import glob
import csv
import math
from openai import OpenAI
from datetime import timedelta

def main(language, api_key, output_filename, bucket_length, video_base_url=None):
    """
    Process MP3 chunks and create a T3C-compatible CSV with timestamps.

    If video_base_url is provided, adds a video-link column that the T3C system
    can use to create clickable video references with timestamps (like Heal Michigan).

    Args:
        video_base_url: Optional base URL for video (e.g., "https://vimeo.com/123456789")
                       If provided, adds video-link column with timestamp parameter
    """
    client = OpenAI(api_key=api_key)

    # List to hold CSV rows and an initial comment_id
    csv_rows = []
    comment_id = 1
    last_processed_file = None
    iterations_filename = 0

    # Get all mp3 files in the current directory
    mp3_files = glob.glob("*.mp3")
    mp3_files.sort()
    if not mp3_files:
        print("No mp3 files found in the current directory.")
    else:
        for filename in mp3_files:
            print(f"Processing file: {filename}")
            try:
                with open(filename, "rb") as audio_file:
                    # Request transcription using OpenAI's Whisper API
                    transcription = client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        response_format="verbose_json",  # Get detailed segments info
                        language=language
                    )
            except Exception as e:
                print(f"Error transcribing {filename}: {e}")
                continue

            # Get segments from the transcription; each segment has a start, end, and text.
            segments = transcription.segments
            if not segments:
                print(f"No transcription segments found for {filename}.")
                continue

            # Determine an approximate total duration from the last segment's end time.
            file_duration = max(seg.end for seg in segments)
            print('file_duration', file_duration)
            # Calculate the number of bucket_length-second buckets we need.
            num_buckets = math.ceil(file_duration / bucket_length)

            print('buckets', num_buckets)
            if last_processed_file:
                print(last_processed_file.rsplit("_chunk", 1)[0], filename.rsplit("_chunk", 1)[0])
                if last_processed_file.rsplit("_chunk", 1)[0] == filename.rsplit("_chunk", 1)[0]:
                    iterations_filename = iterations_filename + 1
                    print('iterations_filename', iterations_filename, 'last_processed_file', last_processed_file, 'filename', filename)

                    # For each bucket-length-second interval, accumulate text
                    # from segments whose start falls in that interval.
                    for bucket in range(num_buckets):
                        bucket_start = bucket * bucket_length
                        bucket_end = bucket_start + bucket_length
                        bucket_texts = []
                        for seg in segments:
                            bucket_start = bucket * bucket_length
                            seg_start = seg.start
                            if seg_start >= bucket_start and seg_start < bucket_end:
                                text = seg.text.strip()
                                bucket_texts.append(text)
                            comment_body = " ".join(bucket_texts).strip()

                        # Calculate actual timestamp in original video
                        # 840 seconds = 14 minutes (per chunk)
                        actual_timestamp = bucket_start + (840 * iterations_filename)

                        row = {
                            "comment-id": comment_id,
                            "interview": filename.rsplit("_chunk", 1)[0],
                            "timestamp": timedelta(seconds=actual_timestamp),
                            "comment-body": comment_body
                        }

                        # Add video link if base URL provided
                        if video_base_url:
                            # Format: HH:MM:SS for timestamp
                            hours = int(actual_timestamp // 3600)
                            minutes = int((actual_timestamp % 3600) // 60)
                            seconds = int(actual_timestamp % 60)
                            timestamp_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
                            row["video-link"] = f"{video_base_url}#{timestamp_str}"

                        print(row)
                        csv_rows.append(row)
                        comment_id += 1
                        last_processed_file = filename
                else:
                    print('new file!')
                    iterations_filename = 0
                    for bucket in range(num_buckets):
                        bucket_start = bucket * bucket_length
                        bucket_end = bucket_start + bucket_length
                        bucket_texts = []
                        for seg in segments:
                            seg_start = seg.start
                            if seg_start >= bucket_start and seg_start < bucket_end:
                                text = seg.text.strip()
                                bucket_texts.append(text)
                            comment_body = " ".join(bucket_texts).strip()

                        row = {
                            "comment-id": comment_id,
                            "interview": filename.rsplit("_chunk", 1)[0],
                            "timestamp": timedelta(seconds=bucket_start),
                            "comment-body": comment_body
                        }

                        # Add video link if base URL provided
                        if video_base_url:
                            hours = int(bucket_start // 3600)
                            minutes = int((bucket_start % 3600) // 60)
                            seconds = int(bucket_start % 60)
                            timestamp_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
                            row["video-link"] = f"{video_base_url}#{timestamp_str}"

                        print(row)
                        csv_rows.append(row)
                        comment_id += 1
                        last_processed_file = filename
            else:
                print('new file!')
                iterations_filename = 0
                for bucket in range(num_buckets):
                    bucket_start = bucket * bucket_length
                    bucket_end = bucket_start + bucket_length
                    bucket_texts = []
                    for seg in segments:
                        seg_start = seg.start
                        if seg_start >= bucket_start and seg_start < bucket_end:
                            text = seg.text.strip()
                            bucket_texts.append(text)
                        comment_body = " ".join(bucket_texts).strip()

                    row = {
                        "comment-id": comment_id,
                        "interview": filename.rsplit("_chunk", 1)[0],
                        "timestamp": timedelta(seconds=bucket_start),
                        "comment-body": comment_body
                    }

                    # Add video link if base URL provided
                    if video_base_url:
                        hours = int(bucket_start // 3600)
                        minutes = int((bucket_start % 3600) // 60)
                        seconds = int(bucket_start % 60)
                        timestamp_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
                        row["video-link"] = f"{video_base_url}#{timestamp_str}"

                    print(row)
                    csv_rows.append(row)
                    comment_id += 1
                    last_processed_file = filename

        # Write CSV with appropriate headers
        fieldnames = ["comment-id", "interview", "timestamp", "comment-body"]
        if video_base_url:
            fieldnames.append("video-link")

        with open(output_filename, mode="w", newline="", encoding="utf-8") as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
            writer.writeheader()
            for row in csv_rows:
                writer.writerow(row)
        print(f"CSV file '{output_filename}' created with transcriptions.")
        if video_base_url:
            print(f"Video links included with base URL: {video_base_url}")


if __name__ == "__main__":
    language = input("Enter the language of the files to process, as a " +
                     "two-letter abbreviation (e.g. 'en', 'es', 'fr'): ")
    api_key = input("Enter your OpenAI API key: ")
    output_file = input("Enter the filename to use for the output file (ending in .csv): ")
    bucket_length = input("Optional: enter the number of seconds per chunk " +
                          "(leave blank for default of 15): ")
    video_url = input("Optional: enter the base video URL (e.g., https://vimeo.com/123456789)\n" +
                      "Leave blank if videos are not hosted: ")

    if not output_file:
        output_file = 'transcriptions.csv'

    if not bucket_length:
        bucket_length = 15
    else:
        bucket_length = int(bucket_length)

    # Only pass video URL if provided
    video_base_url = video_url.strip() if video_url.strip() else None

    main(language, api_key, output_file, bucket_length, video_base_url)
