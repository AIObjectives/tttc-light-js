import { describe, test, expect } from "vitest";
import { Array, pipe } from "effect";

import { setupTestState } from "./testStateSetup";
import {
  defaultAddSubtopicPagination,
  defaultAddTopicPagination,
  defaultSubtopicPagination,
  defaultTopicPagination,
} from "../consts";
import { ReportState, SubtopicNode, TopicNode } from "../types";

const { state, reducer } = setupTestState();

const getTestTopic = (state: ReportState): TopicNode => state.children[0];

const getTestSubtopic = (state: ReportState): SubtopicNode =>
  getTestTopic(state).children[0];

const incrementTopic = (reportState: ReportState, id: string) =>
  reducer(reportState, { type: "expandTopic", payload: { id } });

const incrementSubtopic = (reportState: ReportState, id: string) =>
  reducer(reportState, { type: "expandSubtopic", payload: { id } });

describe("Topic Node", () => {
  const newState1 = incrementTopic(state, getTestTopic(state).id);
  const newState2 = incrementTopic(newState1, getTestTopic(newState1).id);
  describe("Precheck", () => {
    test("Make sure our test topic's children length is >= 3", () => {
      expect(getTestTopic(state).children.length).greaterThanOrEqual(3);
    });

    test("Make sure our test topic's pag is set to default", () => {
      expect(getTestTopic(state).pagination).toBe(defaultTopicPagination);
    });
  });

  test("Incrementing once results in the topic's pagination going up by the set amount", () => {
    expect(getTestTopic(newState1).pagination).toBe(
      defaultTopicPagination + defaultAddTopicPagination,
    );
  });

  test("Incrementing twice works", () => {
    expect(getTestTopic(newState2).pagination).toBe(
      defaultTopicPagination + defaultAddTopicPagination * 2,
    );
  });

  test("Caps at children's length", () => {
    // apply increment a bunch of times and make sure it caps off at right point
    const maxLen = getTestTopic(state).children.length - 1;
    const newState = pipe(
      Array.replicate(incrementTopic, maxLen),
      Array.reduce(state, (accumState, f) =>
        f(accumState, getTestTopic(state).id),
      ),
    );
    expect(getTestTopic(newState).pagination).toBe(maxLen);
  });
});

describe("Subtopic Node", () => {
  const maxLen = getTestSubtopic(state).children.length - 1;
  const newState1 = incrementSubtopic(state, getTestSubtopic(state).id);
  const newState2 = incrementSubtopic(newState1, getTestSubtopic(state).id);

  describe("Precheck", () => {
    test("Make sure our test subtopic's children legnth is >= 10", () => {
      expect(getTestSubtopic(state).children.length).toBeGreaterThanOrEqual(10);
    });

    test("Make sure test subtopics pag is at default", () => {
      expect(getTestSubtopic(state).pagination).toBe(defaultSubtopicPagination);
    });
  });

  test("Incrementing once results in default + add amount", () => {
    expect(getTestSubtopic(newState1).pagination).toBe(
      defaultSubtopicPagination + defaultAddSubtopicPagination,
    );
  });

  test("Incrementing twice results in appropriate amount", () => {
    expect(getTestSubtopic(newState2).pagination).toBe(
      defaultSubtopicPagination + defaultAddSubtopicPagination * 2,
    );
  });

  test("Caps at childrens length", () => {
    // apply increment a ton of times and make sure it caps at right point
    const newState = pipe(
      Array.replicate(incrementSubtopic, maxLen),
      Array.reduce(state, (accumState, f) =>
        f(accumState, getTestSubtopic(state).id),
      ),
    );
    expect(getTestSubtopic(newState).pagination).toBe(maxLen);
  });
});

describe("Error state", () => {
  test("Giving an invalid id results in an error", () => {
    const badState = incrementTopic(state, "Invalid id");
    expect(badState.error).toBeTypeOf("string");
  });
});
