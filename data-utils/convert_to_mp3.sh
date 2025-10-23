#!/bin/bash
#
# Convert video/audio files to MP3 format
#
# Simple wrapper around ffmpeg for batch MP3 conversion
# Useful for preparing files for transcription
#
# Usage:
#   ./convert_to_mp3.sh video.mp4
#   ./convert_to_mp3.sh *.mp4 --output-dir ./audio
#   ./convert_to_mp3.sh chunks/*.mp4 --quality 2

set -e

# Defaults
OUTPUT_DIR="."
QUALITY=2  # 0-9, lower is better (2 is good balance)
OVERWRITE=false

# Help
show_help() {
    cat << EOF
Usage: $(basename "$0") <files...> [OPTIONS]

Convert video/audio files to MP3 format for transcription.

Arguments:
  <files>                Video or audio files to convert

Options:
  --output-dir DIR       Output directory (default: current directory)
  --quality N            MP3 quality 0-9, lower=better (default: 2)
  --overwrite            Overwrite existing MP3 files
  --help                 Show this help

Examples:
  # Convert single file
  ./convert_to_mp3.sh video.mp4

  # Convert multiple files to specific directory
  ./convert_to_mp3.sh chunks/*.mp4 --output-dir ./audio

  # High quality conversion
  ./convert_to_mp3.sh *.mp4 --quality 0

  # Overwrite existing files
  ./convert_to_mp3.sh *.mp4 --overwrite
EOF
}

# Parse arguments
FILES=()
while [[ $# -gt 0 ]]; do
    case $1 in
        --output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --quality)
            QUALITY="$2"
            shift 2
            ;;
        --overwrite)
            OVERWRITE=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        -*)
            echo "Error: Unknown option $1" >&2
            show_help
            exit 1
            ;;
        *)
            FILES+=("$1")
            shift
            ;;
    esac
done

# Validate
if [ ${#FILES[@]} -eq 0 ]; then
    echo "Error: No files specified" >&2
    show_help
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Convert files
echo "Converting ${#FILES[@]} files to MP3..."
echo "Output directory: $OUTPUT_DIR"
echo "Quality: $QUALITY (0=best, 9=worst)"
echo ""

CONVERTED=0
SKIPPED=0

for input_file in "${FILES[@]}"; do
    if [ ! -f "$input_file" ]; then
        echo "⚠ Skipping (not found): $input_file"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    # Determine output filename
    base=$(basename "$input_file")
    name="${base%.*}"
    output_file="$OUTPUT_DIR/${name}.mp3"

    # Check if already exists
    if [ -f "$output_file" ] && [ "$OVERWRITE" = false ]; then
        echo "⏭ Skipping (exists): $base → ${name}.mp3"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    # Convert
    echo "Converting: $base → ${name}.mp3"
    if ffmpeg -i "$input_file" -vn -acodec libmp3lame -q:a "$QUALITY" "$output_file" -loglevel error -y; then
        CONVERTED=$((CONVERTED + 1))
    else
        echo "✗ Error converting: $input_file" >&2
        SKIPPED=$((SKIPPED + 1))
    fi
done

echo ""
echo "========================================"
echo "Conversion complete"
echo "========================================"
echo "Converted: $CONVERTED"
echo "Skipped:   $SKIPPED"
echo "Output:    $OUTPUT_DIR"
echo ""

# Show file sizes
if [ $CONVERTED -gt 0 ]; then
    echo "MP3 files:"
    ls -lh "$OUTPUT_DIR"/*.mp3 | tail -5 | awk '{print "  " $9 " (" $5 ")"}'
    if [ $CONVERTED -gt 5 ]; then
        echo "  ... and $((CONVERTED - 5)) more"
    fi
fi
