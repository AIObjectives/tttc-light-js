#!/bin/bash
#
# Unified video transcription pipeline
#
# This script orchestrates the complete workflow:
# 1. Chunk videos into 14-minute segments
# 2. Convert to MP3 for efficient processing
# 3. Transcribe with natural speech segments
# 4. Merge granular segments intelligently
# 5. Output in T3C format
#
# Usage:
#   ./process_videos.sh --input-dir "./videos" --output transcriptions.csv
#
# With all options:
#   ./process_videos.sh \
#       --input-dir "./videos" \
#       --output transcriptions.csv \
#       --language en \
#       --merge-segments \
#       --min-words 10 \
#       --resume

set -e  # Exit on error

# Cleanup temp files on exit
cleanup_temp_files() {
    if [ -n "$TEMP_LIST" ] && [ -f "$TEMP_LIST" ]; then
        rm -f "$TEMP_LIST"
    fi
}
trap cleanup_temp_files EXIT INT TERM

# Validate required tools
check_dependencies() {
    local missing=()

    if ! command -v ffmpeg &> /dev/null; then
        missing+=("ffmpeg")
    fi

    if ! command -v ffprobe &> /dev/null; then
        missing+=("ffprobe")
    fi

    if ! command -v python3 &> /dev/null; then
        missing+=("python3")
    fi

    # Check Python version (require 3.10+)
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        REQUIRED_VERSION="3.10"
        if ! awk -v ver="$PYTHON_VERSION" -v req="$REQUIRED_VERSION" 'BEGIN{exit!(ver>=req)}'; then
            echo -e "${RED}Error: Python $PYTHON_VERSION found, but $REQUIRED_VERSION+ required${NC}" >&2
            echo "Please upgrade Python or use a virtual environment with Python $REQUIRED_VERSION+" >&2
            exit 1
        fi
    fi

    if [ ${#missing[@]} -ne 0 ]; then
        echo -e "${RED}Error: Missing required tools: ${missing[*]}${NC}" >&2
        echo "" >&2
        echo "Please install:" >&2
        for tool in "${missing[@]}"; do
            if [ "$tool" = "python3" ]; then
                echo "  - python3: Install from python.org or your package manager" >&2
            else
                echo "  - $tool: Install ffmpeg from ffmpeg.org or your package manager" >&2
            fi
        done
        exit 1
    fi
}

# Default values
INPUT_DIR=""
INPUT_TYPE="auto"  # auto, video, audio, mp3
OUTPUT_FILE="transcriptions_t3c.csv"
LANGUAGE="en"
MERGE_SEGMENTS=true
MIN_WORDS=10
RESUME=false
WORK_DIR="./video_processing_$(date +%s)"
KEEP_INTERMEDIATES=false
SKIP_CHUNKING=false
SKIP_CONVERSION=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Help message
show_help() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Unified video transcription pipeline for T3C format output.

Required:
  --input-dir DIR         Directory containing video files (MP4, etc.)

Optional:
  --output FILE           Output CSV file (default: transcriptions_t3c.csv)
  --language CODE         Language code (default: en)
  --merge-segments        Enable segment merging (default: true)
  --no-merge-segments     Disable segment merging
  --min-words N           Min words per segment when merging (default: 10)
  --work-dir DIR          Working directory for intermediates
  --keep-intermediates    Keep chunk files after completion
  --resume                Resume from last completed step
  --estimate-cost         Estimate API cost and exit
  --help                  Show this help message

Environment Variables:
  OPENAI_API_KEY          OpenAI API key (required for transcription)

Examples:
  # Basic usage
  export OPENAI_API_KEY="sk-..."
  ./process_videos.sh --input-dir "./videos" --output transcriptions.csv

  # Full options
  ./process_videos.sh \\
      --input-dir "./videos" \\
      --output transcriptions.csv \\
      --language en \\
      --merge-segments \\
      --min-words 10

  # Estimate cost first
  ./process_videos.sh --input-dir "./videos" --estimate-cost
EOF
}

# Parse arguments
ESTIMATE_ONLY=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --input-dir)
            INPUT_DIR="$2"
            shift 2
            ;;
        --output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --language)
            LANGUAGE="$2"
            shift 2
            ;;
        --merge-segments)
            MERGE_SEGMENTS=true
            shift
            ;;
        --no-merge-segments)
            MERGE_SEGMENTS=false
            shift
            ;;
        --min-words)
            MIN_WORDS="$2"
            shift 2
            ;;
        --work-dir)
            WORK_DIR="$2"
            shift 2
            ;;
        --keep-intermediates)
            KEEP_INTERMEDIATES=true
            shift
            ;;
        --resume)
            RESUME=true
            shift
            ;;
        --estimate-cost)
            ESTIMATE_ONLY=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown option $1${NC}" >&2
            show_help
            exit 1
            ;;
    esac
done

# Validate required arguments
if [ -z "$INPUT_DIR" ]; then
    echo -e "${RED}Error: --input-dir is required${NC}" >&2
    show_help
    exit 1
fi

if [ ! -d "$INPUT_DIR" ]; then
    echo -e "${RED}Error: Input directory does not exist: $INPUT_DIR${NC}" >&2
    exit 1
fi

# Check dependencies first
check_dependencies

# Check for API key (unless estimating)
if [ "$ESTIMATE_ONLY" = false ] && [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}Error: OPENAI_API_KEY environment variable not set${NC}" >&2
    exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "======================================================================="
echo "Video Transcription Pipeline"
echo "======================================================================="
echo "Input directory: $INPUT_DIR"
echo "Output file:     $OUTPUT_FILE"
echo "Language:        $LANGUAGE"
echo "Merge segments:  $MERGE_SEGMENTS"
if [ "$MERGE_SEGMENTS" = true ]; then
    echo "Min words:       $MIN_WORDS"
fi
echo "Work directory:  $WORK_DIR"
echo ""

# Create work directory
mkdir -p "$WORK_DIR"
CHUNKS_DIR="$WORK_DIR/chunks"
MP3_DIR="$WORK_DIR/mp3s"

# Step 1: Chunk videos
echo "======================================================================="
echo "Step 1/5: Chunking videos into 14-minute segments"
echo "======================================================================="

if [ "$RESUME" = true ] && [ -d "$CHUNKS_DIR" ] && [ "$(ls -A "$CHUNKS_DIR" 2>/dev/null)" ]; then
    echo -e "${YELLOW}⏭  Skipping (chunks exist)${NC}"
    CHUNK_COUNT=$(find "$CHUNKS_DIR" -name "*.mp4" 2>/dev/null | wc -l)
    echo "   Found $CHUNK_COUNT existing chunks"
else
    mkdir -p "$CHUNKS_DIR"

    # Use process substitution to avoid subshell issue
    while IFS= read -r video; do
        echo "Processing: $(basename "$video")"
        "$SCRIPT_DIR/chunk_audio_ffmpeg.sh" "$video" "$CHUNKS_DIR"
    done < <(find "$INPUT_DIR" -type f \( -name "*.mp4" -o -name "*.mov" -o -name "*.avi" \))

    CHUNK_COUNT=$(find "$CHUNKS_DIR" -name "*.mp4" 2>/dev/null | wc -l)
    echo -e "${GREEN}✓ Created $CHUNK_COUNT chunks${NC}"
fi
echo ""

# Step 2: Convert to MP3
echo "======================================================================="
echo "Step 2/5: Converting chunks to MP3"
echo "======================================================================="

if [ "$RESUME" = true ] && [ -d "$MP3_DIR" ] && [ "$(ls -A "$MP3_DIR" 2>/dev/null)" ]; then
    echo -e "${YELLOW}⏭  Skipping (MP3s exist)${NC}"
    MP3_COUNT=$(find "$MP3_DIR" -name "*.mp3" 2>/dev/null | wc -l)
    echo "   Found $MP3_COUNT existing MP3s"
else
    mkdir -p "$MP3_DIR"

    # Use process substitution to avoid subshell issue
    while IFS= read -r chunk; do
        base=$(basename "$chunk" .mp4)
        echo "Converting: $base"
        ffmpeg -i "$chunk" -vn -acodec libmp3lame -q:a 2 "$MP3_DIR/${base}.mp3" -loglevel error -y
    done < <(find "$CHUNKS_DIR" -name "*.mp4")

    MP3_COUNT=$(find "$MP3_DIR" -name "*.mp3" 2>/dev/null | wc -l)
    echo -e "${GREEN}✓ Created $MP3_COUNT MP3 files${NC}"
fi
echo ""

# Estimate cost if requested
if [ "$ESTIMATE_ONLY" = true ]; then
    echo "======================================================================="
    echo "Cost Estimation"
    echo "======================================================================="
    # Use find to avoid glob expansion limits
    TEMP_LIST=$(mktemp)
    find "$MP3_DIR" -name "*.mp3" > "$TEMP_LIST"
    if [ -s "$TEMP_LIST" ]; then
        xargs python3 "$SCRIPT_DIR/transcribe.py" --estimate-cost < "$TEMP_LIST"
    else
        echo "No MP3 files found"
    fi
    rm "$TEMP_LIST"
    exit 0
fi

# Step 3: Transcribe
echo "======================================================================="
echo "Step 3/5: Transcribing with natural speech segments"
echo "======================================================================="

TRANSCRIPTION_FILE="$WORK_DIR/transcriptions_raw.csv"

if [ "$RESUME" = true ] && [ -f "$TRANSCRIPTION_FILE" ]; then
    echo -e "${YELLOW}⏭  Skipping (transcription exists)${NC}"
else
    MERGE_FLAG=""
    if [ "$MERGE_SEGMENTS" = false ]; then
        MERGE_FLAG="--no-merge-segments"
    fi

    # Use find to avoid glob expansion limits
    TEMP_LIST=$(mktemp)
    find "$MP3_DIR" -name "*.mp3" | sort > "$TEMP_LIST"

    if [ -s "$TEMP_LIST" ]; then
        xargs python3 "$SCRIPT_DIR/transcribe.py" \
            --output "$TRANSCRIPTION_FILE" \
            --language "$LANGUAGE" \
            $MERGE_FLAG \
            --min-words "$MIN_WORDS" \
            --format t3c \
            < "$TEMP_LIST"
        echo -e "${GREEN}✓ Transcription complete${NC}"
    else
        echo -e "${RED}Error: No MP3 files found to transcribe${NC}" >&2
        rm "$TEMP_LIST"
        exit 1
    fi
    rm "$TEMP_LIST"
fi
echo ""

# Step 4: Final processing (copy to output location)
echo "======================================================================="
echo "Step 4/5: Finalizing output"
echo "======================================================================="

cp "$TRANSCRIPTION_FILE" "$OUTPUT_FILE"
echo -e "${GREEN}✓ Output saved to: $OUTPUT_FILE${NC}"
echo ""

# Step 5: Cleanup
echo "======================================================================="
echo "Step 5/5: Cleanup"
echo "======================================================================="

if [ "$KEEP_INTERMEDIATES" = false ]; then
    echo "Removing intermediate files..."
    rm -rf "$CHUNKS_DIR" "$MP3_DIR"
    echo -e "${GREEN}✓ Cleanup complete${NC}"
    echo ""
    echo "Note: Final transcription kept at: $OUTPUT_FILE"
    echo "      Working directory: $WORK_DIR (safe to delete)"
else
    echo -e "${YELLOW}⏭  Keeping all intermediates (as requested)${NC}"
    echo "Intermediate files location: $WORK_DIR"
fi
echo ""

# Summary
echo "======================================================================="
echo "COMPLETE"
echo "======================================================================="
SEGMENT_COUNT=$(wc -l < "$OUTPUT_FILE")
SEGMENT_COUNT=$((SEGMENT_COUNT - 1))  # Subtract header
echo "Output file:  $OUTPUT_FILE"
echo "Segments:     $SEGMENT_COUNT"
echo "Format:       T3C (id, interview, timestamp, comment)"
echo ""
echo "Ready to upload to T3C!"
echo "======================================================================="
