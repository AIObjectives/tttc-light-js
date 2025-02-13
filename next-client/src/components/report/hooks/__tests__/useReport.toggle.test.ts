import { describe, test, expect } from "vitest";
import { ReportState, TopicNode, __internals } from "../useReportState";
import { reportData } from "stories/data/dummyData";

const { createPathMapReducer, stateBuilder, mapIdsToPath } = __internals;

const state = stateBuilder(reportData.topics);

const reducer = createPathMapReducer(mapIdsToPath(state));

const getTestTopic = (state: ReportState): TopicNode => state.children[0];

const toggle = (state: ReportState) =>
  reducer(state, {
    type: "toggleTopic",
    payload: { id: getTestTopic(state).id },
  });

describe("Toggle Topic", () => {
  const newState = toggle(state);

  test("Initial toggle sets topic to open", () => {
    expect(getTestTopic(newState).isOpen).toBe(true);
  });

  test("Applying twice sets topic to close", () => {
    const closedState = toggle(newState);
    expect(getTestTopic(closedState).isOpen).toBe(false);
  });
});
