# Critical Rules

These rules are non-negotiable. Violations will cause bugs, security issues, or workflow problems.

## Avoid Scope Creep

**CRITICAL**: When fixing bugs or implementing features, stay focused on the specific task at hand.

**Guidelines:**
1. **Fix Only What's Broken**: Address only the specific issue or feature requested
2. **Resist Temptation**: Even if you notice other improvements, don't include them
3. **Separate Concerns**: Each change should have a single, clear purpose
4. **Ask Before Expanding**: If you believe additional changes are necessary, ask first

**Why this matters:**
- Smaller, focused changes are easier to review
- Isolated changes reduce testing surface area
- Each additional change increases the chance of introducing bugs
- Clean git history with atomic commits for each purpose

**The best PR does exactly what was asked—nothing more, nothing less.**

## Git Rules

### No Bulk Staging

**NEVER use `git add -A` or `git add .`** - These stage all files indiscriminately.

```bash
# BAD: Stages everything including untracked files
git add -A
git add .
git add --all

# GOOD: Stage specific files
git add next-client/src/components/MyComponent.tsx
git add express-server/src/routes/myRoute.ts
```

**Why**: The repository has local-only files that should never be committed.

### No Stash with Untracked

**NEVER use `git stash -u`** - It stashes untracked files which may include important local-only files.

```bash
# BAD
git stash -u
git stash --include-untracked

# GOOD
git stash  # Only stashes tracked, modified files
```

### No Attribution Lines in Commits

**Do NOT add Claude attribution to commit messages.** Skip these lines entirely:
- `Generated with [Claude Code]`
- `Co-Authored-By: Claude`
- Any similar AI attribution

Just write a normal commit message describing the change.

## Never Use `any` Types

**CRITICAL: Never use `any` types** - they eliminate TypeScript's safety benefits.

```typescript
// BAD
const mockReq = { params: {} } as any;
const claimData = claims.map((clm: any) => clm.id);

// GOOD
const mockReq: RequestWithLogger = createMockRequest({ id: "123" });
const claimData = claims.map((clm: ClaimType) => clm.id);
```

**Key principles:**
- Prefer **type inference** when TypeScript can determine the type
- Use **explicit types from your schema** (e.g., `schema.LLMClaim`)
- Create **proper type definitions** instead of bypassing with `any`
- If you think you need `any`, there's almost always a better solution

## Firebase SDK Separation

**Client SDK** (`firebase/*`) and **Admin SDK** (`firebase-admin`) must NEVER be in the same package.

```typescript
// next-client uses ONLY client SDK
import { getAuth } from "firebase/auth";

// express-server uses ONLY admin SDK
import * as admin from "firebase-admin";

// NEVER mix in the same package
```

**Why**: Security, type conflicts, and build issues.

## Language Preferences

Avoid corporate jargon:
- Never use "quick wins" — say "small standalone PRs"
- Avoid buzzwords like "leverage", "synergy", "align"
