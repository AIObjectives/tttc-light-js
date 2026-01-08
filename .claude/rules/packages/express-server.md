---
paths: express-server/**/*.ts
---

# Express Server Rules

## Firebase Admin SDK

This package uses `firebase-admin` ONLY. See `00-critical.md` for the full Firebase SDK separation rule.

## Rate Limiting

The server uses per-IP rate limiting with Redis:

**Current limits:**
- Auth endpoints: 5000 requests / 15 min per IP
- Report endpoints: 2000 requests / 15 min per IP

Rate limits only enforced in production (`NODE_ENV=production`).

**Monitoring:**
```bash
redis-cli KEYS "*rate-limit*"
pnpm logs server prod --since 1h | grep "rate limit"
```

## Request Types

Use project-specific extended types:

```typescript
import type { Request, Response } from "express";
import { RequestWithLogger } from "../types/request";

export async function handler(req: RequestWithLogger, res: Response) {}
```

## Pino Logging

Use `tttc-common/logger` with module-specific child loggers. See `02-code-style.md` for structured logging patterns and security guidelines.

## Environment Variables

Required in `express-server/.env`:
- `NODE_ENV`
- `CLIENT_BASE_URL`
- `PYSERVER_URL`
- `FIREBASE_CREDENTIALS_ENCODED`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_URL`
- `OPENAI_API_KEY`
- `ALLOWED_ORIGINS`
- `GCLOUD_STORAGE_BUCKET`
- `GOOGLE_CREDENTIALS_ENCODED`
