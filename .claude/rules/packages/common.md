---
paths: common/**/*.ts
---

# Common Package Rules

## No Pino Logger in Browser-Bundled Code

**CRITICAL**: Use `tttc-common/logger/browser` in files imported by browser code. Never use Pino directly.

See `02-code-style.md` for the full logging guidelines including the location/logger table.

**Affected files in common/:**
- `common/schema/index.ts` - Used by Next.js components
- Any utility functions imported by `next-client/`
- Any code bundled via Storybook

## Verification

Before committing changes to `common/`:

```bash
# Check for pino imports in schema files (should be empty)
grep -r "from.*logger" common/schema/

# Build and test
pnpm --filter=tttc-common run build
pnpm --filter=tttc-common run test
```

## Schema System

See `04-architecture.md` for schema system overview. Use Zod schemas from `common/schema/index.ts` throughout the codebase.

## Building

```bash
pnpm --filter=tttc-common run build   # Build once
pnpm build:common                      # Build and restart PM2 services
```

**Important**: Build `common` before other services when starting development.
