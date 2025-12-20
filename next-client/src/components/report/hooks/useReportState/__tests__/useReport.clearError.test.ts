import { describe, expect, test } from "vitest";
import type { ReportState } from "../types";
import { setupTestState } from "./testStateSetup";

const { state, reducer } = setupTestState();

const errorMessage = "This is an error message";

const errorState = {
  ...state,
  error: errorMessage,
};

const clearError = (reportState: ReportState) =>
  reducer(reportState, { type: "clearError" });

describe("Clear Error", () => {
  test("Initial state has an error", () => {
    expect(errorState.error).toBe(errorMessage);
  });

  test("Clearing error sets it back to null", () => {
    const newState = clearError(errorState);
    expect(newState.error).toBeNull();
  });
});
