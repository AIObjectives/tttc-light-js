#!/bin/bash
# Wrapper script to run csv_natural_segments.py
# This script uses Whisper's natural speech boundaries instead of fixed time chunks
# Better for claim extraction - preserves sentence/phrase boundaries

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
python "$SCRIPT_DIR/csv_natural_segments.py" "$@"
