# Testing Guidelines

## Running Tests

```bash
pnpm test                               # All tests
pnpm --filter=next-client run test      # Client tests
pnpm --filter=express-server run test   # Server tests
pnpm --filter=tttc-common run test      # Common tests
```

## Test Mocking Strategy

**Use focused mock factories instead of `any`:**

```typescript
// GOOD: Standardized test helpers
import { createMinimalTestEnv } from "../__tests__/helpers";

const createMockRequest = (
  params: Record<string, string> = {},
): RequestWithLogger => ({
  params,
  context: { env: createMinimalTestEnv() },
  log: mockLogger,
});

// BAD: Lazy any casting
const mockReq = { params: {} } as any;
```

## Standardized Test Environment Helpers

Located in `express-server/src/__tests__/helpers/`:

- **`createMinimalTestEnv()`** - Basic env for most route tests
- **`createUnitTestEnv()`** - Ultra-minimal for pure function tests
- **`createSecurityTestEnv()`** - Optimized for CSV/security tests

```typescript
import { createSecurityTestEnv } from "../../__tests__/helpers";
req.context = { env: createSecurityTestEnv() };
```

**Benefits:**
- Type-safe with full TypeScript validation
- Consistent setup across tests
- Only includes needed properties
- Single source of truth for test config

## Console Mocking for `common/` Tests

When testing code that uses console logging:

```typescript
let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  consoleInfoSpy.mockRestore();
});

it("logs metrics when processing", () => {
  someFunction();

  expect(consoleInfoSpy).toHaveBeenCalled();
  const [message, data] = consoleInfoSpy.mock.calls[0];
  expect(message).toBe("[module-name] Processing complete");
  expect(data).toMatchObject({ count: 5 });
});
```

## Local Workflow Testing

Test GitHub Actions locally using act:

```bash
timeout 900 ~/bin/act pull_request --job validate
```

**Note**: Workflow testing requires extended timeouts (15+ minutes).
