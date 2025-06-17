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

const open = (state: OutlineState, id: string) =>
  reducer(state, { type: "open", payload: { id } });

describe("Opening topic nodes", () => {
  const newState = Array.reduce(
    outlineState.tree,
    outlineState,
    (accum, curr) => {
      return open(accum, curr.id);
    },
  );

  test("When a topic node is opened, its isOpen value is set to true", () => {
    const vals = newState.tree.map((node) => node.isOpen);
    expect(vals).toEqual(Array.makeBy(vals.length, () => true));
  });

  test("Opening a topic is idempotent", () => {
    const secondState = Array.reduce(newState.tree, newState, (accum, curr) => {
      return open(accum, curr.id);
    });

    const vals = secondState.tree.map((node) => node.isOpen);
    expect(vals).toEqual(Array.makeBy(vals.length, () => true));
  });
});
