/**
 * Base vitest setup for all packages.
 *
 * Provides:
 * - Console error/warn interception for React warnings (opt-in strict mode)
 * - Automatic mock cleanup between tests
 * - Real timer restoration
 *
 * Usage in vitest.config.ts:
 *   setupFiles: ['tttc-common/test-utils/setup/base']
 *
 * For strict mode (fail on ALL console.error/warn), set:
 *   STRICT_CONSOLE_CHECKS=true
 */
import { afterEach, beforeAll, vi } from "vitest";

// Strict mode: fail on ALL console.error/warn (opt-in)
const STRICT_MODE = process.env.STRICT_CONSOLE_CHECKS === "true";

// Patterns that always indicate a problem (fail test if seen)
const REACT_WARNING_PATTERNS = [
  /Warning:/,
  /Each child in a list should have a unique "key" prop/,
  /Cannot update a component.*while rendering a different component/,
  /React does not recognize the.*prop on a DOM element/,
  /Invalid prop.*supplied to/,
  /Failed prop type/,
  /validateDOMNesting/,
];

// Track expected console calls to allow intentional error/warn logging in tests
const expectedConsoleCalls = {
  errors: new Set<string | RegExp>(),
  warns: new Set<string | RegExp>(),
};

/**
 * Mark a console.error message as expected (won't fail the test).
 * Call this before the code that triggers the error.
 */
export function expectConsoleError(messagePattern: string | RegExp): void {
  expectedConsoleCalls.errors.add(messagePattern);
}

/**
 * Mark a console.warn message as expected (won't fail the test).
 * Call this before the code that triggers the warning.
 */
export function expectConsoleWarn(messagePattern: string | RegExp): void {
  expectedConsoleCalls.warns.add(messagePattern);
}

function matchesPattern(msgStr: string, pattern: string | RegExp): boolean {
  return typeof pattern === "string"
    ? msgStr.includes(pattern)
    : pattern.test(msgStr);
}

function isExpected(
  message: unknown,
  expectedSet: Set<string | RegExp>,
): boolean {
  const msgStr = String(message);
  return Array.from(expectedSet).some((pattern) =>
    matchesPattern(msgStr, pattern),
  );
}

function isReactWarning(message: unknown): boolean {
  const msgStr = String(message);
  return REACT_WARNING_PATTERNS.some((pattern) => pattern.test(msgStr));
}

// Store original console methods
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Intercept console.error
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const message = args[0];

    // Always allow explicitly expected messages
    if (isExpected(message, expectedConsoleCalls.errors)) {
      originalConsoleError.apply(console, args);
      return;
    }

    // In strict mode, fail on any unexpected error
    // In normal mode, only fail on React warnings
    const shouldFail = STRICT_MODE || isReactWarning(message);

    if (shouldFail) {
      originalConsoleError.apply(console, args);
      throw new Error(
        `Unexpected console.error: ${String(message).slice(0, 200)}`,
      );
    }

    // Pass through other errors (framework errors, etc.)
    originalConsoleError.apply(console, args);
  });

  // Intercept console.warn
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    const message = args[0];

    // Always allow explicitly expected messages
    if (isExpected(message, expectedConsoleCalls.warns)) {
      originalConsoleWarn.apply(console, args);
      return;
    }

    // In strict mode, fail on any unexpected warning
    // In normal mode, only fail on React warnings
    const shouldFail = STRICT_MODE || isReactWarning(message);

    if (shouldFail) {
      originalConsoleWarn.apply(console, args);
      throw new Error(
        `Unexpected console.warn: ${String(message).slice(0, 200)}`,
      );
    }

    // Pass through other warnings (framework warnings, etc.)
    originalConsoleWarn.apply(console, args);
  });
});

afterEach(() => {
  // Clear all mocks between tests
  vi.clearAllMocks();

  // Restore real timers if fake timers were used
  vi.useRealTimers();

  // Clear expected console call patterns for next test
  expectedConsoleCalls.errors.clear();
  expectedConsoleCalls.warns.clear();
});
