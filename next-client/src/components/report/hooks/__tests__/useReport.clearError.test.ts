import { describe, test, expect } from "vitest";
import { ReportState, __internals } from "../useReportState";
import { reportData } from "stories/data/dummyData";

const { createPathMapReducer, stateBuilder, mapIdsToPath } = __internals;

const errorMessage = "This is an error message";

const state = {
  ...stateBuilder(reportData.topics),
  error: errorMessage,
};

const reducer = createPathMapReducer(mapIdsToPath(state));
const clearError = (reportState: ReportState) =>
  reducer(reportState, { type: "clearError" });

describe("Clear Error", () => {
  test("Initial state has an error", () => {
    expect(state.error).toBe(errorMessage);
  });

  test("Clearing error sets it back to null", () => {
    const newState = clearError(state);
    expect(newState.error).toBeNull();
  });
});
