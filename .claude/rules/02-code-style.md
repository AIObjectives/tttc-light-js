# Code Style Guidelines

## TypeScript

### Type Safety

Never use `any` types. See `00-critical.md` for details.

**Type inference:**
```typescript
// Let TypeScript infer when it can
const topicEntry = sortData.find(([tag]) => tag === t.topicName);

// Use explicit types from schema
const claimData = claims.map((clm: schema.LLMClaim) => clm.id);
```

**Type conflicts resolution:**
```typescript
import type { Request, Response } from "express";
import { RequestWithLogger } from "../types/request";

export async function handler(req: RequestWithLogger, res: Response) {}
```

**Type assertions (when absolutely necessary):**
```typescript
// Use double assertion for safety
value as unknown as TargetType

// Add comments explaining why
// Avoid `as any` - it's almost never right
```

## Zod Schema Patterns

**Discriminated unions:**
```typescript
// GOOD: Clear variants
const response = z.discriminatedUnion("success", [
  z.object({ success: z.literal(true), data: z.string() }),
  z.object({ success: z.literal(false), error: z.string() }),
]);

// BAD: Optional fields without clear relationship
const response = z.object({
  success: z.boolean(),
  data: z.string().optional(),
  error: z.string().optional(),
});
```

**Defaults for robust parsing:**
```typescript
const reportSchema = z.object({
  title: z.string().default("Untitled Report"),
  count: z.number().default(0),
});
```

## Environment Variables

**Plain `KEY=value` format in `.env` files:**
```bash
# BAD
export DATABASE_URL=postgres://localhost/mydb

# GOOD
DATABASE_URL=postgres://localhost/mydb
```

**Why**: Docker Compose doesn't support `export` prefix.

**Loading in shell:**
```bash
set -a; source .env; set +a
```

## Pino Logging

**Module-specific child loggers:**
```typescript
import { logger } from "tttc-common/logger";
const featureFlagLogger = logger.child({ module: "feature-flags" });
```

**Structured logging:**
```typescript
// BAD: Template literals
logger.info(`Flag ${flagName} = ${result} for user ${userId}`);

// GOOD: Structured data
featureFlagLogger.info(
  { flagName, result, userId },
  "Feature flag evaluated"
);
```

**Security:**
- Never log passwords, tokens, full emails
- Mask PII: `user@example.com` → `us***@example.com`

## Logging in `common/` Package

**CRITICAL**: Never use pino logger directly in `common/` files imported by browser code.

```typescript
// BAD: Breaks Storybook builds
import { logger } from "../logger";
cruxLogger.info({ data }, "Message");

// GOOD: Use browser-safe logger
import { logger } from "tttc-common/logger/browser";
logger.info({ data }, "Message");
```

**Why**: Pino has Node.js dependencies that fail webpack bundling.

| Location | Logger |
|----------|--------|
| `express-server/` | Pino (`tttc-common/logger`) |
| `next-client/` | Browser logger (`tttc-common/logger/browser`) |
| `common/` (browser-imported) | Browser logger (`tttc-common/logger/browser`) |

## Biome Configuration

Key lint rules:
- `noUnusedVariables` and `noUnusedImports` as warnings
- `noExplicitAny` as warning
- Recommended rules from all categories

Pre-commit hook runs automatically.
