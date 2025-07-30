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

const highlight = (state: OutlineState, id: string) =>
  reducer(state, { type: "highlight", payload: { id } });

const getTestTopic = (state: OutlineState) => state.tree[0];

const getTestSubtopic = (state: OutlineState) => state.tree[0].children[0];

describe("Highlighting outline topic nodes", () => {
  test("Highlighting a topic node sets its isHighlighted state to true", () => {
    const newState = highlight(outlineState, getTestTopic(outlineState).id);
    expect(getTestTopic(newState).isHighlighted).true;
  });
});

describe("Highlighting outline subtopic nodes", () => {
  test("Highlighting a subtopic node sets its isHighlighted state to true", () => {
    const newState = highlight(outlineState, getTestSubtopic(outlineState).id);
    expect(getTestSubtopic(newState).isHighlighted).true;
  });
});

describe("Highlighting another node resets the previous", () => {
  const newState = Array.reduce(
    outlineState.tree,
    outlineState,
    (accum, curr) => {
      return highlight(accum, curr.id);
    },
  );
  test("Only one is highlighted", () => {
    expect(newState.tree.filter((node) => node.isHighlighted).length).toBe(1);
  });

  test("Last one is highlighted", () => {
    expect(newState.tree[newState.tree.length - 1].isHighlighted).true;
  });

  describe("Highlight handles the transition from topic -> subtopic -> topic", () => {
    const newState = highlight(outlineState, getTestTopic(outlineState).id);
    const subtopicHighlighted = highlight(
      newState,
      getTestSubtopic(newState).id,
    );
    test("Start at topic", () => {
      expect(getTestTopic(newState).isHighlighted).true;
    });

    test("Topic -> Subtopic", () => {
      expect(getTestSubtopic(subtopicHighlighted).isHighlighted).true;
      expect(getTestTopic(subtopicHighlighted).isHighlighted).false;
    });

    test("Subtopic -> Topic", () => {
      const topicRehighlighted = highlight(
        subtopicHighlighted,
        getTestTopic(subtopicHighlighted).id,
      );
      expect(getTestSubtopic(topicRehighlighted).isHighlighted).false;
      expect(getTestTopic(topicRehighlighted).isHighlighted).true;
    });
  });
});
