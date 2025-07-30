import { describe, test, expect } from "vitest";
import { __internals, OutlineState } from "../useOutlineState";
import { stateBuilder as reportStateBuilder } from "../../../report/hooks/useReportState/utils";
import { reportData } from "../../../../../stories/data/dummyData";
import { Array } from "effect";

const { createReducer, mapIdsToPath, createInitialState } = __internals;

const reportState = reportStateBuilder(reportData.topics);
const outlineState = createInitialState(reportState);
const idMap = mapIdsToPath(reportState);
const reducer = createReducer(idMap);

const open = (state: OutlineState, id: string) =>
  reducer(state, { type: "open", payload: { id } });

const close = (state: OutlineState, id: string) =>
  reducer(state, { type: "close", payload: { id } });

describe("Closing topic nodes", () => {
  const openState = Array.reduce(
    outlineState.tree,
    outlineState,
    (accum, curr) => {
      return open(accum, curr.id);
    },
  );

  const newState = Array.reduce(openState.tree, openState, (accum, curr) => {
    return close(accum, curr.id);
  });

  test("When a topic node is closed, its isOpen value is set to false", () => {
    const vals = newState.tree.map((node) => node.isOpen);
    expect(vals).toEqual(Array.makeBy(vals.length, () => false));
  });

  test("Closing a topic is idempotent", () => {
    const secondState = Array.reduce(newState.tree, newState, (accum, curr) => {
      return close(accum, curr.id);
    });

    const vals = secondState.tree.map((node) => node.isOpen);
    expect(vals).toEqual(Array.makeBy(vals.length, () => false));
  });
});
