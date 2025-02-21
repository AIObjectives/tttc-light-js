import { describe, test, expect } from "vitest";
import {
  ReportState,
  SomeNode,
  SubtopicNode,
  TopicNode,
  __internals,
} from "../useReportState";
import { reportData } from "stories/data/dummyData";
import { Array, pipe } from "effect";

const {
  createPathMapReducer,
  stateBuilder,
  mapIdsToPath,
  defaultTopicPagination,
  defaultAddTopicPagination,
  defaultSubtopicPagination,
  defaultAddSubtopicPagination,
} = __internals;

const state = stateBuilder(reportData.topics);

const reducer = createPathMapReducer(mapIdsToPath(state));

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
    test("Make sure our test topic's children length is >= 6", () => {
      expect(getTestTopic(state).children.length).greaterThanOrEqual(6);
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
    const childrenLen = getTestTopic(state).children.length;
    const newState = pipe(
      Array.replicate(incrementTopic, childrenLen),
      Array.reduce(state, (accumState, f) =>
        f(accumState, getTestTopic(state).id),
      ),
    );
    expect(getTestTopic(newState).pagination).toBe(childrenLen);
  });
});

describe("Subtopic Node", () => {
  const childrenLen = getTestSubtopic(state).children.length;
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
      Array.replicate(incrementSubtopic, childrenLen),
      Array.reduce(state, (accumState, f) =>
        f(accumState, getTestSubtopic(state).id),
      ),
    );
    expect(getTestSubtopic(newState).pagination).toBe(childrenLen);
  });
});

describe("Error state", () => {
  test("Giving an invalid id results in an error", () => {
    const badState = incrementTopic(state, "Invalid id");
    expect(badState.error).toBeTypeOf("string");
  });
});
