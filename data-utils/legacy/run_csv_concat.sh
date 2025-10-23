#!/bin/bash
# Wrapper script to run csv_concat.py with the pyserver virtual environment
# This script processes mp3 chunks and creates a T3C-compatible CSV with timestamps
# NOTE: Run this script from the directory containing your MP3 files

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Stay in the current working directory (where MP3s are)
# Just activate venv and run the script
source "$SCRIPT_DIR/../pyserver/.venv/bin/activate"
python "$SCRIPT_DIR/csv_concat.py" "$@"
