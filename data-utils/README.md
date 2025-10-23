# Video Transcription Tools

Scripts for transcribing audio/video files and preparing them for T3C (Talk to the City) report generation.

## Quick Start

### Already Have Audio Files?

```bash
export OPENAI_API_KEY="sk-..."
python transcribe.py audio/*.mp3 --output transcriptions.csv
```

### Have Videos?

```bash
# Convert to MP3
./convert_to_mp3.sh videos/*.mp4 --output-dir ./audio

# Transcribe
export OPENAI_API_KEY="sk-..."
python transcribe.py audio/*.mp3 --output transcriptions.csv
```

### Long Videos (>15 minutes)?

```bash
# Chunk into 14-minute segments (Whisper limit)
./chunk_audio_ffmpeg.sh long_video.mp4 --output-dir ./chunks

# Convert and transcribe
./convert_to_mp3.sh chunks/*.mp4 --output-dir ./audio
python transcribe.py audio/*.mp3 --output transcriptions.csv
```

### Want Full Automation?

```bash
export OPENAI_API_KEY="sk-..."
./process_videos.sh --input-dir "./videos" --output transcriptions.csv
```

## Core Tools

**transcribe.py** - Main transcription tool

```bash
# Basic transcription
python transcribe.py audio/*.mp3 --output transcriptions.csv

# Preview before running (no API calls)
python transcribe.py audio/*.mp3 --dry-run

# Append to existing dataset (continue ID sequence)
python transcribe.py new_audio/*.mp3 --output more.csv --start-id 357
```

Features: Natural speech segments, automatic fragment merging, cost estimation (`--estimate-cost`), preview mode (`--dry-run`), ID continuation (`--start-id`)

**convert_to_mp3.sh** - Batch MP3 conversion

```bash
./convert_to_mp3.sh videos/*.mp4 --output-dir ./audio
```

**chunk_audio_ffmpeg.sh** - Split long videos

```bash
./chunk_audio_ffmpeg.sh video.mp4 --output-dir ./output-dir
```

**process_videos.sh** - Automated pipeline wrapper

```bash
./process_videos.sh --input-dir "./videos" --output transcriptions.csv --resume
```

**Post-Processing Tools:**

- `merge_segments.py` - Rule-based segment merger (combines short fragments)
- `split_long_documents.py` - Sentence-based splitter for very long documents
- `llm_merge_comments.py` - LLM-assisted intelligent merging (see below)
- `get_video_duration.sh` - Duration/cost estimation
- `create_t3c_csv.py` - Format converter
- `merge_responses.py` - Multi-source merger example

## Output Format

T3C-compatible CSV format:

```csv
id,interview,timestamp,comment
1,Interview Name,0:00:00,Transcribed text here...
2,Interview Name,0:00:12,Next segment...
```

## Command-Line Flags Reference

### transcribe.py

| Flag                  | Description                                    | Example                       |
| --------------------- | ---------------------------------------------- | ----------------------------- |
| `--output FILE`       | Output CSV file path                           | `--output transcriptions.csv` |
| `--language CODE`     | Language code (default: en)                    | `--language es`               |
| `--min-words N`       | Minimum words per segment (default: 10)        | `--min-words 15`              |
| `--start-id N`        | Starting ID for segments (for appending)       | `--start-id 357`              |
| `--estimate-cost`     | Calculate API cost and exit (no transcription) | `--estimate-cost`             |
| `--dry-run`           | Preview files without processing               | `--dry-run`                   |
| `--format FORMAT`     | Output format: csv or t3c (default: t3c)       | `--format csv`                |
| `--no-merge-segments` | Disable automatic fragment merging             | `--no-merge-segments`         |
| `--help`              | Show help message                              | `--help`                      |

### process_videos.sh

| Flag                   | Description                                       | Example                  |
| ---------------------- | ------------------------------------------------- | ------------------------ |
| `--input-dir DIR`      | Directory containing video files (required)       | `--input-dir "./videos"` |
| `--output FILE`        | Output CSV file (default: transcriptions_t3c.csv) | `--output results.csv`   |
| `--language CODE`      | Language code (default: en)                       | `--language es`          |
| `--merge-segments`     | Enable segment merging (default: true)            | `--merge-segments`       |
| `--no-merge-segments`  | Disable segment merging                           | `--no-merge-segments`    |
| `--min-words N`        | Min words per segment when merging (default: 10)  | `--min-words 15`         |
| `--work-dir DIR`       | Working directory for intermediates               | `--work-dir ./temp`      |
| `--keep-intermediates` | Keep chunk files after completion                 | `--keep-intermediates`   |
| `--resume`             | Resume from last completed step                   | `--resume`               |
| `--estimate-cost`      | Estimate API cost and exit                        | `--estimate-cost`        |
| `--help`               | Show help message                                 | `--help`                 |

### convert_to_mp3.sh

| Flag               | Description                                   | Example                |
| ------------------ | --------------------------------------------- | ---------------------- |
| `--output-dir DIR` | Output directory for MP3 files                | `--output-dir ./audio` |
| `--quality N`      | MP3 quality 0-9, lower is better (default: 2) | `--quality 4`          |
| `--help`           | Show help message                             | `--help`               |

### chunk_audio_ffmpeg.sh

| Flag               | Description                                     | Example                 |
| ------------------ | ----------------------------------------------- | ----------------------- |
| `input_file`       | Path to video/audio file (positional, required) | `video.mp4`             |
| `--output-dir DIR` | Directory to save chunks (default: current dir) | `--output-dir ./chunks` |
| `--help`           | Show help message                               | `--help`                |

### llm_merge_comments.py

| Flag                | Description                                     | Example               |
| ------------------- | ----------------------------------------------- | --------------------- |
| `--input FILE`      | Input CSV file (default: transcriptions.csv)    | `--input data.csv`    |
| `--output FILE`     | Output CSV file (default: transcriptions.csv)   | `--output merged.csv` |
| `--dry-run`         | Preview merge decisions without applying        | `--dry-run`           |
| `--dry-run-limit N` | Number of merge checks in dry-run (default: 10) | `--dry-run-limit 20`  |
| `--quiet, -q`       | Suppress progress output                        | `--quiet`             |
| `--help`            | Show help message                               | `--help`              |

### split_long_documents.py

| Flag            | Description                                   | Example              |
| --------------- | --------------------------------------------- | -------------------- |
| `--input FILE`  | Input CSV file (default: transcriptions.csv)  | `--input data.csv`   |
| `--output FILE` | Output CSV file (default: transcriptions.csv) | `--output split.csv` |
| `--dry-run`     | Preview splits without applying               | `--dry-run`          |
| `--threshold N` | Min words to split (default: 500)             | `--threshold 600`    |
| `--help`        | Show help message                             | `--help`             |

### merge_segments.py

| Flag         | Description                                | Example      |
| ------------ | ------------------------------------------ | ------------ |
| `input_csv`  | CSV file to process (positional, required) | `data.csv`   |
| `output_csv` | Output file (default: input_merged.csv)    | `merged.csv` |
| `min_words`  | Minimum words per segment (default: 10)    | `15`         |

### get_video_duration.sh

| Flag         | Description                                     | Example                |
| ------------ | ----------------------------------------------- | ---------------------- |
| `video_file` | One or more video files to analyze (positional) | `video.mp4 video2.mp4` |
| `--help`     | Show help message                               | `--help`               |

## Design Philosophy

**Composable Tools** - Each tool does one thing well and can be used independently or chained together.

**Non-Interactive** - All tools support CLI arguments, environment variables, and `--help` documentation for automation and AI-agent compatibility.

**Key Features:**

- Natural speech segments (Whisper's sentence detection)
- Two-stage merging:
  - Rule-based: Combines short fragments (< 10 words)
  - LLM-assisted: Intelligently merges related thoughts
- Resume support
- Cost estimation
- T3C-ready output

## Requirements

- Python 3.x with OpenAI library: `pip install openai`
- ffmpeg for video/audio processing
- OpenAI API key (set via `OPENAI_API_KEY` env var)

## Advanced Post-Processing

### Splitting Long Documents

If your CSV contains pasted documents rather than transcribed speech (>500 words), split them first:

```bash
# Preview what would be split
python split_long_documents.py --input data.csv --dry-run

# Split long documents into sentence-based segments
python split_long_documents.py --input data.csv --output data.csv
```

**How it works:**

- Identifies comments >500 words (likely pasted documents)
- Splits by sentence boundaries into ~250-word segments
- Preserves `[Question: ...]` prefixes on first segment only
- Maintains metadata (interview name, timestamp)

### LLM-Assisted Merging

After transcription (or after splitting), use LLM evaluation to intelligently merge related segments:

```bash
# Preview merge decisions (first 10 pairs per interview)
python llm_merge_comments.py --input data.csv --dry-run

# Execute full merge
python llm_merge_comments.py --input data.csv --output data.csv
```

**How it works:**

- Uses OpenAI (gpt-4o-mini) to evaluate consecutive segment pairs
- Merges segments that form continuous thoughts or sentences
- Respects natural boundaries (question markers, long pauses >20s)
- Privacy: Only sends comment text to API, no PII (names, IDs, timestamps)
- Cost: ~$0.15-0.20 per 450 segments
- Typical reduction: 5-15% fewer segments with better cohesion

**Safety features:**

- Automatic backup (`.pre-llm-merge` suffix)
- Dry-run mode for previewing decisions
- Never merges across question boundaries
- Skips very long segments (>150 words)
- Sliding window algorithm for iterative merging

### Recommended Workflow for Mixed Data

If you have both transcribed speech AND pasted documents:

```bash
# 1. Split any very long documents first
python split_long_documents.py --input data.csv --output data.csv

# 2. Then run LLM merge to intelligently recombine
python llm_merge_comments.py --input data.csv --output data.csv
```

This gives you the best of both: long documents broken down for better T3C clustering, but related sentences recombined intelligently.

## Common Options

```bash
# Estimate cost before processing
python transcribe.py audio/*.mp3 --estimate-cost

# Resume interrupted processing
./process_videos.sh --input-dir "./videos" --output final.csv --resume

# Non-English audio
python transcribe.py audio/*.mp3 --language es --output spanish.csv

# Get help
python transcribe.py --help
./process_videos.sh --help
```

## Known Limitations

### Sentence Splitting with Abbreviations

The `split_long_documents.py` tool may incorrectly split on abbreviations:

- "Mr. Smith" may split after "Mr."
- "U.S. Congress" may split after "U.S."
- "Ph.D. candidate" may split after "Ph.D."

**Mitigation:** Run `llm_merge_comments.py` after splitting - the LLM will intelligently recombine incorrectly split segments.

**Impact:** Low - most federal employee transcripts use formal language without many abbreviations.

## Migration Notes

Old scripts moved to `legacy/` directory:

- `csv_natural_segments.py` → `transcribe.py` (non-interactive)
- `run_csv_natural_segments.sh` → CLI args instead of prompts
- `chunk_audio.py` → `chunk_audio_ffmpeg.sh` (Python 3.13 compatible)
