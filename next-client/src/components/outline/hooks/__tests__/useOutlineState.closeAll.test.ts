import { describe, test, expect } from "vitest";
import { __internals, OutlineState } from "../useOutlineState";
import { stateBuilder as reportStateBuilder } from "../../../report/hooks/useReportState/utils";
import { reportData } from "../../../../../stories/data/dummyData";
import { Array } from "effect";

const { createReducer, mapIdsToPath, createInitialState } = __internals;

const reportState = reportStateBuilder(reportData.topics);
const outlineState = createInitialState(reportState);
const idMap = mapIdsToPath(outlineState);
const reducer = createReducer(idMap);

const openAll = (state: OutlineState) => reducer(state, { type: "openAll" });

const closeAll = (state: OutlineState) => reducer(state, { type: "closeAll" });

describe("Closing all topic nodes", () => {
  test("Opening and then closing all topics nodes sets isOpen to false", () => {
    const openedState = openAll(outlineState);
    const closedState = closeAll(openedState);
    const vals = closedState.tree.map((node) => node.isOpen);
    expect(vals).toEqual(Array.makeBy(vals.length, () => false));
  });
});
