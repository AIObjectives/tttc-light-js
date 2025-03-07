import { describe, test, expect } from "vitest";
import { ReportState, __internals } from "../useReportState";
import { reportData } from "stories/data/dummyData";

const { createPathMapReducer, stateBuilder, mapIdsToPath } = __internals;

const state = stateBuilder(reportData.topics);

const reducer = createPathMapReducer(mapIdsToPath(state));
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
