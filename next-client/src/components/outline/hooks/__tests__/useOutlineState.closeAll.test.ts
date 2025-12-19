import { Array as Arr } from "effect";
import { describe, expect, test } from "vitest";
import { reportData } from "../../../../../stories/data/dummyData";
import { stateBuilder as reportStateBuilder } from "../../../report/hooks/useReportState/utils";
import { __internals, type OutlineState } from "../useOutlineState";

const { createReducer, mapIdsToPath, createInitialState } = __internals;

const reportState = reportStateBuilder(reportData.topics);
const outlineState = createInitialState(reportState);
const idMap = mapIdsToPath(reportState);
const reducer = createReducer(idMap);

const openAll = (state: OutlineState) => reducer(state, { type: "openAll" });

const closeAll = (state: OutlineState) => reducer(state, { type: "closeAll" });

describe("Closing all topic nodes", () => {
  test("Opening and then closing all topics nodes sets isOpen to false", () => {
    const openedState = openAll(outlineState);
    const closedState = closeAll(openedState);
    const vals = closedState.tree.map((node) => node.isOpen);
    expect(vals).toEqual(Arr.makeBy(vals.length, () => false));
  });
});
