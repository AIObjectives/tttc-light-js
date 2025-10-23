# Legacy Scripts - Deprecated

⚠️ **DO NOT USE THESE SCRIPTS** ⚠️

These scripts are kept for reference only and should not be used for new work.

## Why are these here?

- **Historical reference**: Shows evolution of the tooling
- **Migration support**: Helps understand old workflows
- **Documentation**: Provides context for design decisions

## What should I use instead?

Use the **new tools in the parent directory**:

- `transcribe.py` - Replaces `csv_natural_segments.py` and `transcribe_audio_files.py`
- `chunk_audio_ffmpeg.sh` - Replaces `chunk_audio.py`
- Command-line arguments - Replaces all `run_*.sh` interactive wrappers

## Key improvements in new tools

1. **Non-interactive**: All tools support CLI arguments (no prompts)
2. **Environment variables**: API keys via `OPENAI_API_KEY` (more secure)
3. **Better error handling**: Clear messages instead of silent failures
4. **Python 3.13 compatible**: Old tools use deprecated libraries
5. **Composable**: Mix and match tools as needed

## Need help?

See the main [README.md](../README.md) in the parent directory for:

- Quick start guides
- Tool reference
- Common workflows
- Examples

---

**Last updated**: October 2025
**Deprecated since**: T3C-416
