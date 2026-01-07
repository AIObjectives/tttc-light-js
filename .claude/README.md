# Claude Code Configuration

This directory contains shared Claude Code configuration for the Talk to the City project.

## Structure

```
.claude/
├── CLAUDE.team.md              # Main team config entry point
├── README.md                   # This file
├── CLAUDE.local.example.md     # Template for personal CLAUDE.md
├── settings.json               # Tool permissions and Claude Code settings
├── skills/                     # Custom slash commands
│   └── cloud-logs.md           # /cloud-logs - fetch Cloud Run logs
└── rules/                      # Auto-loaded rules
    ├── 00-critical.md          # Non-negotiable rules
    ├── 01-development.md       # Commands and workflows
    ├── 02-code-style.md        # TypeScript, Zod, logging
    ├── 03-testing.md           # Test patterns
    ├── 04-architecture.md      # Project structure
    ├── 05-git-workflow.md      # Commits and code review
    ├── 06-debugging.md         # Cloud Run logs, debugging
    ├── 07-subagents-skills.md  # Subagents and MCP
    └── packages/               # Package-specific rules
        ├── express-server.md
        ├── next-client.md
        ├── common.md
        └── pyserver.md
```

## How It Works

Claude Code automatically loads:
1. `.claude/settings.json` - Tool permissions (allowedTools, disallowedTools)
2. `.claude/CLAUDE.team.md` - Main team config
3. All files in `.claude/rules/` (numbered for load order)
4. Package-specific rules when working in those directories
5. Skills from `.claude/skills/` (available as slash commands)

## Tool Permissions (settings.json)

The `settings.json` file enforces critical rules programmatically:

**Pre-approved commands** (no permission prompt):
- `pnpm *` - All pnpm commands
- `git status`, `git diff`, `git log`, `git checkout`, `git fetch`, `git show`
- `git branch` (list only, not create/delete)
- `gcloud logging read`, `gcloud run services list/describe`, `gcloud run revisions list`
- All Playwright MCP tools

**Blocked commands** (enforces rules from `00-critical.md`):
- `git add -A`, `git add .`, `git add --all` - Bulk staging
- `git stash -u`, `git stash --include-untracked` - Stash with untracked

Force push is NOT blocked because it's sometimes legitimate on feature branches. The markdown rules handle this with warnings instead.

## Custom Skills

Skills in `.claude/skills/` appear as slash commands:

| Skill | Command | Purpose |
|-------|---------|---------|
| cloud-logs.md | `/cloud-logs` | Fetch Cloud Run logs for debugging |

To add a new skill, create a markdown file in `.claude/skills/` with frontmatter:
```markdown
---
description: Short description for slash command menu
user-invocable: true
---
# Skill instructions here
```
1. `.claude/CLAUDE.team.md`
2. All files in `.claude/rules/` (numbered for load order)
3. Package-specific rules when working in those directories

## Memory Hierarchy

If you have an existing personal `CLAUDE.md` in the project root:

1. **Personal CLAUDE.md takes priority** (highest in hierarchy)
2. **`.claude/rules/*.md` auto-loads alongside**
3. Both are active; personal overrides team where they conflict

## Integration Options

Choose how to integrate team config with your setup:

### Option A: Use Team Config Only (Recommended for new devs)

Move or delete your personal CLAUDE.md:
```bash
mv CLAUDE.md ~/.claude/CLAUDE.backup-personal.md
```

Claude Code will use `.claude/CLAUDE.team.md` and `.claude/rules/` as primary config.

### Option B: Hybrid (Import team config in personal)

Create a minimal personal CLAUDE.md that imports team config:
```markdown
# My Personal CLAUDE.md
@.claude/CLAUDE.team.md

## My Additions
- Personal preferences here
```

### Option C: Personal Priority

Keep your personal CLAUDE.md. Team rules still auto-load from `.claude/rules/` as baseline, but your personal config takes priority where they conflict.

### Option D: Ignore Team Config

Keep your personal CLAUDE.md without changes. It will override team rules where they conflict. Team rules still load but at lower priority.

## Optional: Auto-Pull Hook

To automatically pull latest config on session start, add to your personal `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "git -C \"${CLAUDE_PROJECT_DIR}\" pull origin main --quiet 2>/dev/null || true",
        "timeout": 3
      }]
    }]
  }
}
```

This is optional and personal (not committed to the repo).

## MCP Servers

Team MCP servers are configured in `.mcp.json` at the project root:
- **Playwright**: Browser automation

No tokens required for the default configuration.

## Keeping Rules Current

Rules should be updated when significant PRs merge that introduce new patterns. Key areas to watch:

| Pattern | Rule File | Trigger |
|---------|-----------|---------|
| State management | `packages/next-client.md` | Zustand PRs (#505, #531) |
| Data fetching | `packages/next-client.md` | TanStack Query PRs (#503, #527-530) |
| Test infrastructure | `03-testing.md` | Shared vitest config PRs (#535-537) |
| Distributed tracing | `06-debugging.md` | Correlation ID PR (#546) |
| Schema validation | `02-code-style.md` | Zod 4 migration (#525) |

**After merging foundation PRs**: Update the corresponding rule files to document the new patterns. This keeps the rules accurate as the codebase evolves.

## Contributing

When updating team config:
1. Edit files in `.claude/`
2. Test that rules load correctly (`/memory` in Claude Code)
3. Submit PR for review
