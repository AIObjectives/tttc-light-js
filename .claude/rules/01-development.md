# Development Commands

## Starting Services

**All services at once:**
```bash
pnpm dev          # Concurrently (human-friendly, colored output)
pnpm dev:start    # PM2 (AI-friendly, backgrounded)
```

**PM2 management:**
```bash
pnpm dev:start    # Start all services
pnpm dev:stop     # Stop all services
pnpm dev:status   # Check service status
pnpm dev:restart server  # Restart specific service
pnpm dev:logs server     # View service logs
pnpm dev:kill     # Stop PM2 daemon completely
```

**Service names:** `common`, `server`, `client`, `pubsub`, `pyserver`

**Individual services:**
```bash
pnpm dev:common   # Common package watch mode
pnpm dev:server   # Express server only
pnpm dev:client   # Next.js client only
pnpm dev:pubsub   # Pub/Sub emulator only
pnpm dev:pyserver # Python server only
```

## Critical Port Requirements

Dev servers MUST run on standard ports:
- **Next.js client**: Port 3000 (required for auth redirects)
- **Express server**: Port 8080
- **Pub/Sub emulator**: Port 8085 (required for report pipeline)
- **Python server**: Port 8000

If a port is in use: `fuser -k 3000/tcp`

## Build Commands

```bash
pnpm build        # Build all packages (common first)
pnpm build:common # Build common and restart PM2 services
```

## Format & Lint

```bash
pnpm format      # Format only
pnpm lint        # Lint only (no fixes)
pnpm lint:fix    # Lint with auto-fixes
pnpm check       # Format + lint + organize imports
pnpm check:fix   # All of the above with fixes
```

Uses Biome. Pre-commit hook runs `biome check --write --staged`.

## Testing

```bash
pnpm test                               # All tests
pnpm --filter=next-client run test      # Client tests
pnpm --filter=express-server run test   # Server tests
pnpm --filter=tttc-common run test      # Common tests
```

## Spell Check

```bash
pnpm spell      # Check spelling in git-tracked files
```

Add new words to `.cspell.json`.

## Code Quality (CodeScene)

```bash
pnpm quality:check   # Fast local check (staged files)
pnpm codescene:pr    # PR analysis vs main branch
cs check <file>      # Check specific file health
```

Target metrics:
- Code health score: 8.0+
- Cyclomatic complexity: ≤10 per function
- Lines of code: ≤60 per function
- Nesting depth: ≤3 levels

## Path Navigation

**Always use pnpm from repository root:**
```bash
# GOOD
pnpm dev:server
pnpm --filter=tttc-common run build

# BAD
cd express-server && npm run dev
```

## Important Notes

- Build `common` package first when starting development
- Use `uvicorn` directly for pyserver (not `fastapi dev`)
- Environment variables required in `express-server/.env` and `next-client/.env`
- Python virtual environment: `source pyserver/.venv/bin/activate`
