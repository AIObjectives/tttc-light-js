#!/bin/bash
# Wrapper script to run csv_natural_segments.py with the pyserver virtual environment
# This script uses Whisper's natural speech boundaries instead of fixed time chunks
# Better for claim extraction - preserves sentence/phrase boundaries

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Stay in the current working directory (where MP3s are)
source "$SCRIPT_DIR/../pyserver/.venv/bin/activate"
python "$SCRIPT_DIR/csv_natural_segments.py" "$@"
