import { describe, test, expect } from "vitest";
import { setupTestState } from "./testStateSetup";
import { ReportState } from "../types";

const { state, reducer } = setupTestState();

const openAll = (reportState: ReportState) =>
  reducer(reportState, { type: "openAll" });

const closeAll = (reportState: ReportState) =>
  reducer(reportState, { type: "closeAll" });

const openedState = openAll(state);
const closedState = closeAll(openedState);

describe("closeAll", () => {
  test("openAll -> closeAll = identity", () => {
    expect(closedState).toMatchReportState(state);
  });
});
