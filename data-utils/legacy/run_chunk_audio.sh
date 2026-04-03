#!/bin/bash
# Wrapper script to run chunk_audio.py

cd "$(dirname "$0")"
python chunk_audio.py "$@"