#!/bin/bash
# Get video duration for invoicing purposes
# Shows duration in multiple formats

set -e

show_help() {
    cat << EOF
Usage: $0 <video_file> [video_file2 ...] [OPTIONS]

Shows video duration(s) for invoicing purposes.
Supports multiple files - will show total if more than one.

Arguments:
  video_file              One or more video files to analyze

Options:
  --help                  Show this help message

Examples:
  $0 video.mp4
  $0 video1.mp4 video2.mp4 video3.mp4
EOF
}

# Check for help flag
for arg in "$@"; do
    if [ "$arg" = "--help" ]; then
        show_help
        exit 0
    fi
done

if [ "$#" -lt 1 ]; then
    echo "Error: At least one video file is required" >&2
    show_help
    exit 1
fi

total_seconds=0
file_count=0

echo "Video Duration Report"
echo "===================="
echo ""

for video_file in "$@"; do
    if [ ! -f "$video_file" ]; then
        echo "Error: File not found: $video_file"
        continue
    fi

    # Get duration in seconds using ffmpeg (fallback to ffprobe if available)
    if command -v ffprobe &> /dev/null; then
        duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$video_file" 2>/dev/null)
    else
        # Parse duration from ffmpeg output: Duration: HH:MM:SS.ms
        duration_str=$(ffmpeg -i "$video_file" 2>&1 | grep "Duration" | awk '{print $2}' | tr -d ',')
        if [ -n "$duration_str" ]; then
            # Convert HH:MM:SS.ms to seconds
            IFS=: read hours minutes seconds <<< "$duration_str"
            duration=$(awk "BEGIN {print ($hours * 3600) + ($minutes * 60) + $seconds}")
        fi
    fi

    if [ -z "$duration" ]; then
        echo "Error: Could not get duration for $video_file"
        continue
    fi

    # Convert to integer seconds (floor)
    seconds=$(printf "%.0f" "$duration")
    total_seconds=$((total_seconds + seconds))
    file_count=$((file_count + 1))

    # Calculate hours, minutes, seconds
    hours=$((seconds / 3600))
    minutes=$(((seconds % 3600) / 60))
    secs=$((seconds % 60))

    # Calculate minutes total
    total_minutes=$((seconds / 60))

    echo "File: $(basename "$video_file")"
    echo "  Duration: ${hours}h ${minutes}m ${secs}s (${total_minutes} minutes / $seconds seconds)"
    echo ""
done

# Show total if multiple files
if [ $file_count -gt 1 ]; then
    echo "===================="
    echo "TOTAL ($file_count files):"

    hours=$((total_seconds / 3600))
    minutes=$(((total_seconds % 3600) / 60))
    secs=$((total_seconds % 60))
    total_minutes=$((total_seconds / 60))

    echo "  Duration: ${hours}h ${minutes}m ${secs}s"
    echo "  Total Minutes: $total_minutes"
    echo "  Total Seconds: $total_seconds"
    echo ""
    echo "For Whisper API invoicing: $total_minutes minutes @ \$0.006/minute = \$$(awk "BEGIN {printf \"%.2f\", $total_minutes * 0.006}")"
fi

if [ $file_count -eq 1 ]; then
    echo "For Whisper API invoicing: $total_minutes minutes @ \$0.006/minute = \$$(awk "BEGIN {printf \"%.2f\", $total_minutes * 0.006}")"
fi
