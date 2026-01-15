# Subagents and Skills

## Built-in Subagents

Claude Code has specialized subagents for different tasks:

### Explore Subagent
**Use for**: Codebase navigation and search
**Model**: Haiku (fast, cheap)
**Access**: Read-only

```
"Find all usages of createReportRef in the codebase"
"What files handle authentication?"
"How does the pipeline worker process jobs?"
```

**Thoroughness levels**: quick, medium, very thorough

### Plan Subagent
**Use for**: Implementation planning before coding
**Model**: Opus (for complex architectural decisions)
**Access**: Research tools

Use when:
- Adding new features
- Multiple valid approaches exist
- Architectural decisions needed
- Multi-file changes

### General-Purpose Subagent
**Use for**: Complex multi-step tasks, code reviews
**Model**: Opus (for thorough analysis)
**Access**: All tools

## When to Use What

| Task | Tool |
|------|------|
| Find files/code | Explore subagent (Haiku) |
| Understand architecture | Explore subagent (Haiku) |
| Plan implementation | Plan mode (Opus) |
| Code reviews | General-purpose subagent (Opus) |
| Complex refactoring | General-purpose subagent (Opus) |
| Simple file edits | Direct tools (Read, Edit) |

## Skills vs MCP Servers

**Skills**: Knowledge and procedures (documentation, workflows)
- Embedded in Claude Code
- No external dependencies
- Example: `/commit`, `/review-pr`

**MCP Servers**: External tool integrations
- Connect to APIs, databases, services
- May require authentication/tokens
- Example: Playwright (browser automation)

## MCP Servers in This Project

Configured in `.mcp.json`:

| Server | Purpose | Token |
|--------|---------|-------|
| Playwright | Browser automation | None |

## Best Practices

1. **Use Explore for searches** instead of manual Glob/Grep when unsure where to look
2. **Enter Plan mode** for non-trivial features before writing code
3. **Let subagents work autonomously** - provide clear prompts, let them research
4. **Use MCP for external data** - don't scrape or manually fetch what MCP provides
