import { describe, test, expect } from "vitest";
import { __internals, OutlineState } from "../useOutlineState";
import { stateBuilder as reportStateBuilder } from "../../../report/hooks/useReportState/utils";
import { reportData } from "../../../../../stories/data/dummyData";

const { createReducer, mapIdsToPath, createInitialState } = __internals;

const reportState = reportStateBuilder(reportData.topics);
const outlineState = createInitialState(reportState);
const idMap = mapIdsToPath(outlineState);
const reducer = createReducer(idMap);

const toggle = (state: OutlineState, id: string) =>
  reducer(state, { type: "toggle", payload: { id } });

const getTestTopic = (state: OutlineState) => state.tree[0];

describe("Toggling topic nodes", () => {
  test("Toggling closed topic opens it", () => {
    const newState = toggle(outlineState, getTestTopic(outlineState).id);
    expect(getTestTopic(newState).isOpen).true;
  });

  test("Toggling twice is the same and doing nothing", () => {
    const newState = toggle(
      toggle(outlineState, getTestTopic(outlineState).id),
      getTestTopic(outlineState).id,
    );
    expect(getTestTopic(newState).isOpen).false;
  });
});
