# Data processing utilities

Scripts in this folder support processing data in preparation for its use
in the T3C pipeline.

Note: these files may require library dependencies not specified in any
requirements.txt file, as this directory is an interim store for logic we will
eventually build into the main pipeline.

## transcribe-audio-files.py

Useful for creating transcriptions of audio datasets to be uploaded as text
data to T3C. Output files do not result in playable audio being included
in the T3C UI.

Requirements:

- folder of audio files to process
- OpenAI API key

## Video data processing

Processing video datasets happens in N steps:

1. Transcribe audio from a video file in 15-minute chunks (chunk_audio.py)
2. Generate a CSV in the correct format for T3C report generation, including
   links to videos, and correct association of video timestamps with transcribed
   content (csv_concat.py)

### chunk_audio.py

Usage:
`python chunk_audio.py <input_file> [<output_directory>]`

- input_file: the video file to transcribe into chunks
- output_directory (optional): where to put chunked audio files. If missing,
  output will be stored in the current directory.

Result: a set of text files
The 15-minute limit is imposed by the Whisper API.

TODO
- imports issue with ffprobe/ffmpeg

### csv_concat.py

TODO this one's complicated and may need some fixes:

- magic 840 number
- testing
