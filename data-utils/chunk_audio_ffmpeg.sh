#!/bin/bash
# Chunk audio files into 14-minute segments using ffmpeg directly
# This avoids the Python 3.13 + pydub compatibility issue

set -e

show_help() {
    cat << EOF
Usage: $0 <input_file> [OPTIONS]

Splits video/audio into 14-minute chunks for Whisper API processing.

Arguments:
  input_file              Path to video or audio file (required)

Options:
  --output-dir DIR        Directory to save chunks (default: current directory)
  --help                  Show this help message

Examples:
  $0 video.mp4
  $0 video.mp4 --output-dir ./chunks
EOF
}

# Parse arguments
INPUT_FILE=""
OUTPUT_DIR="."

while [[ $# -gt 0 ]]; do
    case $1 in
        --help)
            show_help
            exit 0
            ;;
        --output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        *)
            if [ -z "$INPUT_FILE" ]; then
                INPUT_FILE="$1"
            else
                echo "Error: Unexpected argument: $1" >&2
                show_help
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate required arguments
if [ -z "$INPUT_FILE" ]; then
    echo "Error: input_file is required" >&2
    show_help
    exit 1
fi

CHUNK_MINUTES=14
CHUNK_SECONDS=$((CHUNK_MINUTES * 60))

# Get the base name without extension
BASENAME=$(basename "$INPUT_FILE")
FILENAME="${BASENAME%.*}"
EXTENSION="${BASENAME##*.}"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Get duration of input file in seconds using ffprobe
if command -v ffprobe &> /dev/null; then
    DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$INPUT_FILE" | cut -d. -f1)
else
    # Fallback to ffmpeg if ffprobe not available
    DURATION=$(ffmpeg -i "$INPUT_FILE" 2>&1 | grep "Duration" | awk '{print $2}' | tr -d , | awk -F: '{print ($1 * 3600) + ($2 * 60) + $3}' | cut -d. -f1)
fi

echo "Input file: $INPUT_FILE"
echo "Duration: $DURATION seconds"
echo "Chunk length: $CHUNK_SECONDS seconds ($CHUNK_MINUTES minutes)"

# Calculate number of chunks
NUM_CHUNKS=$(( (DURATION + CHUNK_SECONDS - 1) / CHUNK_SECONDS ))
echo "Creating $NUM_CHUNKS chunk(s)..."

# Split into chunks
for ((i=0; i<NUM_CHUNKS; i++)); do
    START_TIME=$((i * CHUNK_SECONDS))
    CHUNK_NUM=$((i + 1))
    OUTPUT_FILE="$OUTPUT_DIR/${FILENAME}_chunk_${CHUNK_NUM}.$EXTENSION"

    echo "Creating chunk $CHUNK_NUM/$NUM_CHUNKS -> $OUTPUT_FILE"
    ffmpeg -i "$INPUT_FILE" -ss $START_TIME -t $CHUNK_SECONDS -c copy "$OUTPUT_FILE" -loglevel error -y
done

echo "Done! Created $NUM_CHUNKS chunk(s) in $OUTPUT_DIR"
