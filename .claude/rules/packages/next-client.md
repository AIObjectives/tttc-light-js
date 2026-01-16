---
paths: next-client/**/*.ts, next-client/**/*.tsx
---

# Next.js Client Rules

## Firebase Client SDK

This package uses `firebase/*` client SDK ONLY. See `00-critical.md` for the full Firebase SDK separation rule.

## ShadCN UI Components

**Always prefer ShadCN components** over custom implementations.

```typescript
// GOOD: Use ShadCN Alert
import { Alert, AlertTitle, AlertDescription } from "@/components/elements";
<Alert variant="warning">
  <AlertTitle>Warning</AlertTitle>
  <AlertDescription>Message here</AlertDescription>
</Alert>

// GOOD: Use Sonner for transient notifications
import { toast } from "sonner";
toast.success("Email sent!", { description: "Check your inbox" });

// BAD: Custom div-based alert
<div className="bg-warning/10 border rounded-lg p-4">...</div>
```

**Component selection:**
| Use Case | Component |
|----------|-----------|
| Inline messages | `Alert` |
| Transient feedback | `Sonner` (toast) |
| Modal dialogs | `Dialog` |
| Side panels | `Sheet` |
| Form inputs | `Input`, `TextArea`, `Select` |
| Buttons | `Button` |

**Adding new components:**
```bash
npx shadcn@latest add alert --yes
# Fix import: import { cn } from "@/lib/utils/shadcn";
# Export from elements/index.ts
```

## Browser-Safe Logging

Use `tttc-common/logger/browser` for all client-side logging. See `02-code-style.md` for the full logging guidelines and API details.

## Environment Variables

Required in `next-client/.env.local`:
- `PIPELINE_EXPRESS_URL`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## Storybook

```bash
pnpm --filter=next-client run storybook
```

**Important**: Never import Pino directly in files bundled by Storybook. Use `tttc-common/logger/browser` instead.
