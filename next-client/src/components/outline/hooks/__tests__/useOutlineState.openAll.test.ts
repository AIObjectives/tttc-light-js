import { Array } from "effect";
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

describe("Open all outline topics", () => {
  test("Opening all sets all topic nodes to open", () => {
    const newState = openAll(outlineState);
    const vals = newState.tree.map((node) => node.isOpen);
    expect(vals).toEqual(Array.makeBy(vals.length, () => true));
  });
});
