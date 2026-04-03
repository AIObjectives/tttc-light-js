#!/bin/bash
# Wrapper script to run csv_concat.py
# This script processes mp3 chunks and creates a T3C-compatible CSV with timestamps
# NOTE: Run this script from the directory containing your MP3 files

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
python "$SCRIPT_DIR/csv_concat.py" "$@"
