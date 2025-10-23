#!/bin/bash
# Wrapper script to run chunk_audio.py with the pyserver virtual environment

cd "$(dirname "$0")"
source ../pyserver/.venv/bin/activate
python chunk_audio.py "$@"