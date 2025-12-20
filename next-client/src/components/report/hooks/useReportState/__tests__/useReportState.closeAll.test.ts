import { describe, expect, test } from "vitest";
import type { ReportState } from "../types";
import { setupTestState } from "./testStateSetup";

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
