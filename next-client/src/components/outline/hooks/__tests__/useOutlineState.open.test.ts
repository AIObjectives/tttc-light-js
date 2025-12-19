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

const open = (state: OutlineState, id: string) =>
  reducer(state, { type: "open", payload: { id } });

describe("Opening topic nodes", () => {
  const newState = Arr.reduce(
    outlineState.tree,
    outlineState,
    (accum, curr) => {
      return open(accum, curr.id);
    },
  );

  test("When a topic node is opened, its isOpen value is set to true", () => {
    const vals = newState.tree.map((node) => node.isOpen);
    expect(vals).toEqual(Arr.makeBy(vals.length, () => true));
  });

  test("Opening a topic is idempotent", () => {
    const secondState = Arr.reduce(newState.tree, newState, (accum, curr) => {
      return open(accum, curr.id);
    });

    const vals = secondState.tree.map((node) => node.isOpen);
    expect(vals).toEqual(Arr.makeBy(vals.length, () => true));
  });
});

describe("Opening claim nodes", () => {
  test("should open parent topic when opening a claim ID", () => {
    const firstClaim = reportState.children[0].children[0].children[0];
    const claimId = firstClaim.id;

    const newState = open(outlineState, claimId);

    expect(newState.tree[0].isOpen).toBe(true);
  });

  test("should not throw error when opening claim ID", () => {
    const firstClaim = reportState.children[0].children[0].children[0];
    const claimId = firstClaim.id;

    expect(() => open(outlineState, claimId)).not.toThrow();
  });
});
