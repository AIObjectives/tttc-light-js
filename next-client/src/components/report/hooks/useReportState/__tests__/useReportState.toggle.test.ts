import { pipe } from "effect";
import { describe, expect, test } from "vitest";
import type { ReportState, TopicNode } from "../";
import { setupTestState } from "./testStateSetup";

const { state, reducer } = setupTestState();

const getTestTopic = (state: ReportState): TopicNode => state.children[0];

const incrementTopic = (reportState: ReportState) =>
  reducer(reportState, {
    type: "expandTopic",
    payload: { id: getTestTopic(state).id },
  });

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

describe("Toggling an open node is equivalent to closing it", () => {
  const newState = pipe(state, toggle, incrementTopic, toggle);
  test("Toggling an open node that has been expended should reset it", () => {
    expect(newState).toMatchReportState(state);
  });
});

describe("Error state", () => {
  test("Giving an invalid id results in an error", () => {
    const badState = reducer(state, {
      type: "toggleTopic",
      payload: { id: "invalid" },
    });
    expect(badState.error).toBeTypeOf("string");
  });
});
