import { describe, expect, test } from "vitest";
import { defaultTopicPagination } from "../consts";
import type { ReportState, SomeNode } from "../types";
import { setupTestState } from "./testStateSetup";

const { state, reducer } = setupTestState();

// Gets a topic at a specific index
const getTopic = (state: ReportState, idx: number = 0) => state.children[idx];

const getMiddleTopic = (state: ReportState) =>
  getTopic(state, Math.floor(state.children.length / 2));

// Gets the last topic
const getLastTopic = (state: ReportState) =>
  getTopic(state, state.children.length - 1);

// gets a subtopic from a topic idx and subtopicidx
const getSubtopic = (
  state: ReportState,
  topicIdx: number = 0,
  subtopicIdx: number = 0,
) => getTopic(state, topicIdx).children[subtopicIdx];

// get a node's id
const getId = (node: SomeNode) => node.data.id;

const firstTopic = getTopic(state);
const lastTopic = getLastTopic(state);
const middleTopic = getMiddleTopic(state);
const testTopics = [firstTopic, middleTopic, lastTopic];
const open = (reportState: ReportState, id: string) =>
  reducer(reportState, { type: "open", payload: { id } });

const close = (reportState: ReportState, id: string) =>
  reducer(reportState, { type: "close", payload: { id } });

describe("Closing -> Topic.isOpen", () => {
  const [firstOpen, middleOpen, lastOpen] = testTopics.map((t) =>
    open(state, getId(t)),
  );
  const [firstClosed, middleClosed, lastClosed] = [
    close(firstOpen, getId(firstTopic)),
    close(middleOpen, getId(middleTopic)),
    close(lastOpen, getId(lastTopic)),
  ];

  test("Closing an opened topic sets it to be close", () => {
    expect(getTopic(firstClosed).isOpen).false;
    expect(getMiddleTopic(middleClosed).isOpen).false;
    expect(getLastTopic(lastClosed).isOpen).false;
  });

  test("Opening and then closing a topic resets it to the original state", () => {
    [firstClosed, middleClosed, lastClosed].forEach((newState) =>
      expect(newState).toMatchReportState(state),
    );
  });
});

describe.skip("Closing -> Topic.pagination", () => {
  const testTopicIdx = 3;
  const testSubtopicHighIdx = 7;
  const getTestTopic = (state: ReportState) => getTopic(state, testTopicIdx);
  const getTestSubtopicHigh = (state: ReportState) =>
    getSubtopic(state, testTopicIdx, testSubtopicHighIdx);

  const openToSubtopicState = open(state, getTestSubtopicHigh(state).id);

  const closedState = close(openToSubtopicState, getTestTopic(state).id);
  test("After opening to a subtopic node, the parent topic pagination is at the default state", () => {
    expect(getTestTopic(closedState).pagination).toBe(defaultTopicPagination);
  });

  test("After opening to a subtopic node, closing resets the state", () => {
    expect(closedState).toMatchReportState(state);
  });
});

describe("Closing -> Subtopic.pagination", () => {
  const testTopicIdx = 3;
  const testSubtopicHighIdx = 7;
  const testClaimHighIdx = 4;
  const getTestSubtopicHigh = (state: ReportState) =>
    getSubtopic(state, testTopicIdx, testSubtopicHighIdx);
  const getTestClaim = (state: ReportState) =>
    getTestSubtopicHigh(state).children[testClaimHighIdx];
  const getTestTopic = (state: ReportState) => getTopic(state, testTopicIdx);

  const openedState = open(state, getId(getTestClaim(state)));
  const closedState = close(openedState, getId(getTestTopic(state)));

  test("Open node -> Close node returns state to original", () => {
    expect(closedState).toMatchReportState(state);
  });
});

describe("Error state", () => {
  test("Giving an invalid id results in an error", () => {
    const badState = close(state, "Invalid id");
    expect(badState.error).toBeTypeOf("string");
  });
});
