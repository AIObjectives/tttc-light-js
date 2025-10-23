#!/usr/bin/env python3

import os
import sys
import math
from pydub import AudioSegment

def chunk_audio(input_file, output_dir=None, chunk_length_minutes=14):
    """
    Splits the given audio file into segments of `chunk_length_minutes`.

    :param input_file:          Path to the input audio file.
    :param output_dir:          Directory where the chunked files will be saved.
                                If None, the chunks will be saved in the same folder
                                as the input file.
    :param chunk_length_minutes: Length of each audio chunk in minutes.
    """

    # Convert minutes to milliseconds for pydub
    chunk_length_ms = chunk_length_minutes * 60 * 1000  # 14 minutes = 840,000 ms

    if output_dir is None:
        # By default, use the same directory as the input_file
        output_dir = os.path.dirname(input_file)

    # Ensure the output directory exists
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Load the audio file using pydub
    audio = AudioSegment.from_file(input_file)

    # Calculate the number of chunks
    total_length_ms = len(audio)
    num_chunks = math.ceil(total_length_ms / chunk_length_ms)

    # Extract the file name (without extension) for naming chunks
    base_name = os.path.splitext(os.path.basename(input_file))[0]
    extension = os.path.splitext(input_file)[1]

    print(f"Splitting '{input_file}' into {num_chunks} chunk(s)...")

    # Create and export each chunk
    for i in range(num_chunks):
        start_ms = i * chunk_length_ms
        end_ms = min((i+1) * chunk_length_ms, total_length_ms)

        chunk = audio[start_ms:end_ms]

        # Construct chunk file name
        chunk_filename = f"{base_name}_chunk_{i+1}{extension}"
        chunk_path = os.path.join(output_dir, chunk_filename)

        print(f"  Saving chunk {i+1} of {num_chunks} -> {chunk_path}")
        chunk.export(chunk_path, format=extension.strip('.').lower())

    print("Done!")

def main():
    if len(sys.argv) < 2:
        print("Usage: python chunk_audio.py <input_file> [<output_dir>]")
        sys.exit(1)

    input_file = sys.argv[1]

    if len(sys.argv) >= 3:
        output_dir = sys.argv[2]
    else:
        output_dir = None

    # Call the chunking function
    chunk_audio(input_file, output_dir=output_dir, chunk_length_minutes=14)

if __name__ == "__main__":
    main()
