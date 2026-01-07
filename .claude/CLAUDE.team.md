# Talk to the City - Team Configuration

This is the shared Claude Code configuration for the Talk to the City project.

## How This Works

Claude Code automatically loads:
1. This file (`.claude/CLAUDE.team.md`)
2. All files in `.claude/rules/` (numbered for load order)
3. Package-specific rules in `.claude/rules/packages/` when working in those directories

## Quick Reference

**Start development:**
```bash
pnpm dev          # All services with concurrently
pnpm dev:start    # All services via PM2 (recommended for Claude Code)
```

**Build and test:**
```bash
pnpm build                              # Build all packages
pnpm test                               # Run all tests
pnpm check                              # Format + lint + organize imports
```

**Cloud Run logs:**
```bash
pnpm logs server staging --since 1h     # Staging server logs
pnpm logs pyserver prod --errors        # Production pyserver errors
```

## MCP Servers

This project uses shared MCP servers configured in `.mcp.json`:
- **Playwright**: Browser automation (no token required)

## Project Structure

```
next-client/     # Next.js frontend (port 3000)
express-server/  # Express backend API (port 8080)
common/          # Shared schemas, types, utilities
pyserver/        # Python FastAPI for LLM processing (port 8000)
pipeline-worker/ # Background job processing
utils/           # Utility scripts
```

## Key Rules

See `.claude/rules/00-critical.md` for non-negotiable rules:
- No scope creep
- No `git add -A` or `git stash -u`
- No `any` types
- Never mix Firebase SDKs

For full documentation, see `.claude/README.md`.
