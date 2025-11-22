import { expect } from "vitest";
import { ReportState } from "@/components/report/hooks/useReportState";
import * as matchers from "@testing-library/jest-dom/matchers";
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

// Extend expect with jest-dom matchers
expect.extend(matchers);

// Helper to get specific differences between objects
function getDifferences(
  actual: any,
  expected: any,
  path: string[] = [],
): string[] {
  if (actual === expected) return [];
  if (typeof actual !== typeof expected) {
    return [
      `${path.join(".")}: type mismatch - got ${typeof actual}, expected ${typeof expected}`,
    ];
  }
  if (actual === null || expected === null) {
    return [`${path.join(".")}: got ${actual}, expected ${expected}`];
  }
  if (typeof actual !== "object") {
    return [`${path.join(".")}: got ${actual}, expected ${expected}`];
  }

  const differences: string[] = [];

  // Handle arrays
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      differences.push(
        `${path.join(".")}: array length mismatch - got ${actual.length}, expected ${expected.length}`,
      );
    }
    const maxLength = Math.max(actual.length, expected.length);
    for (let i = 0; i < maxLength; i++) {
      differences.push(
        ...getDifferences(actual[i], expected[i], [...path, `[${i}]`]),
      );
    }
    return differences;
  }

  // Handle objects
  const allKeys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  for (const key of allKeys) {
    if (!(key in actual)) {
      differences.push(
        `${path.join(".")}${path.length ? "." : ""}${key}: missing in actual`,
      );
      continue;
    }
    if (!(key in expected)) {
      differences.push(
        `${path.join(".")}${path.length ? "." : ""}${key}: unexpected in actual`,
      );
      continue;
    }
    differences.push(
      ...getDifferences(actual[key], expected[key], [...path, key]),
    );
  }

  return differences;
}

expect.extend({
  toMatchReportState(actual: ReportState, expected: ReportState) {
    const differences = getDifferences(actual, expected);

    const pass = differences.length === 0;

    return {
      pass,
      message: () =>
        pass
          ? "ReportStates match"
          : "ReportStates differ in the following ways:\n" +
            differences.join("\n"),
    };
  },
});

// Add type support for custom matchers
declare module "vitest" {
  interface Assertion<T = any>
    extends TestingLibraryMatchers<typeof expect.stringContaining, T> {
    toMatchReportState(expected: ReportState): void;
  }
}
