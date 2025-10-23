#!/bin/bash
# Wrapper script to run csv_concat_with_video.py with the pyserver virtual environment
# This enhanced version adds optional video-link column for clickable timestamps

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
source ../pyserver/.venv/bin/activate
python csv_concat_with_video.py "$@"
