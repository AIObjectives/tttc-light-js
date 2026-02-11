# Git Workflow

## Commit Messages

- Prefix with Linear ticket number: `T3C-123: Add feature`
- Keep commit messages concise and descriptive
- Focus on what changed and why
- **Do NOT add Claude attribution lines**

## Pull Requests

**Do NOT include Claude Code attribution** in PR descriptions. Skip these lines entirely:
- `Generated with [Claude Code]`
- `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- Any similar AI attribution

Just write a normal PR description with summary and test plan.

## Code Review Process

**CRITICAL**: When reviewing PRs, work with complete file content.

**Use extended thinking (ultrathink)** for thorough code reviews.

**Required steps:**
```bash
# 1. Checkout PR branch first
git fetch origin pull/PR_NUMBER/head:pr-PR_NUMBER
git checkout pr-PR_NUMBER

# 2. Read actual files, not parsed diffs
```

**Why**: `gh pr diff` is often truncated for large PRs. Reading actual files guarantees complete context.

**Avoid:**
```markdown
# BAD: Asserting unused based on truncated diff
"CHUNK_SIZE constant appears unused"
(When it's used later in the file you didn't see)

# GOOD: Qualified statement
"In the visible portion of the diff, CHUNK_SIZE appears unused -
please verify if it's used elsewhere"
```

## Review Focus

Prioritize critical analysis over praise:

- **Identify real issues**: bugs, edge cases, security, maintainability
- **Be specific**: Point to concrete technical issues
- **Avoid excessive praise**: Skip superlatives and cheerleading
- **No emojis in reviews**: Keep feedback professional

**Review checklist:**
- Security vulnerabilities?
- Error handling gaps?
- Edge cases not handled?
- Performance concerns?
- Missing validation or tests?
- Breaking changes?

**Frontend-specific (next-client):**
- Mobile compatibility?
- Accessibility (a11y)?
- UX best practices?

## GitHub CLI

**PR management:**
```bash
gh pr view <number>      # Details
gh pr diff <number>      # Changes
gh pr checks <number>    # CI status
gh pr list               # Open PRs
```

**Workflow debugging:**
```bash
gh run list              # Recent runs
gh run view <run-id>     # Run details
gh run view <run-id> --log-failed  # Failed job logs
```

**API access:**
```bash
gh api repos/AIObjectives/tttc-light-js/pulls/<pr>/comments
```

## Error Interpretation

**Don't assume file truncation** when error line numbers don't match file lengths.

**Debugging order:**
1. Assume error is stale/cached - check if it reproduces locally
2. Consider build artifacts or source maps
3. Check environment differences (CI vs local)
4. Only then consider file integrity issues

**Key insight**: Error messages can be stale, especially in CI. Line numbers often refer to built code, not source files.
