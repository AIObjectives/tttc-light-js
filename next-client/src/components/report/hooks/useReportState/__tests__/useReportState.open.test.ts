import { describe, test, expect } from "vitest";
import { setupTestState } from "./testStateSetup";
import { ReportState, SomeNode } from "../types";
import { defaultSubtopicPagination, defaultTopicPagination } from "../consts";

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

describe("Open", () => {
  describe("Opening topics", () => {
    const [first, middle, last] = testTopics.map((t) => open(state, getId(t)));

    describe("Opens a closed topic", () => {
      // does the first topic open
      test("Opens first topic", () => {
        expect(getTopic(first).isOpen).true;
      });
      // does the middle topic open
      test("Opens middle topic", () => {
        expect(getMiddleTopic(middle).isOpen).true;
      });
      // does the last topic open
      test("Opens last topic", () => {
        expect(getLastTopic(last).isOpen).true;
      });
    });

    test("Opened node is the only opened node", () => {
      expect(
        [first, middle, last]
          .map((rs) => rs.children.filter((t) => t.isOpen).length)
          .every((n) => n === 1),
      ).true;
    });

    test("Opening another node doesn't affect original", () => {
      const withSecondOpened = [first, middle, last].map((s) =>
        open(s, getId(getTopic(s, 1))),
      );

      expect(
        withSecondOpened
          .map((s) => s.children.filter((t) => t.isOpen).length)
          .every((n) => n == 2),
      ).true;
    });

    test("Open is idempotent", () => {
      const firstAgain = open(first, getId(firstTopic));
      const middleAgain = open(middle, getId(middleTopic));
      const lastAgain = open(last, getId(lastTopic));

      expect(
        [firstAgain, middleAgain, lastAgain]
          .map((s) => s.children.filter((t) => t.isOpen).length)
          .every((n) => n == 1),
      ).true;
    });
  });

  describe("Opening to subtopics", () => {
    const testTopicIdx = 0;
    const testSubtopicHighIdx = 2;
    const testSubtopicLowIdx = 1;
    const getTestTopic = (state: ReportState) => getTopic(state, testTopicIdx);
    const getTestSubtopicHigh = (state: ReportState) =>
      getSubtopic(state, testTopicIdx, testSubtopicHighIdx);
    const getTestSubtopicLow = (state: ReportState) =>
      getSubtopic(state, testTopicIdx, testSubtopicLowIdx);

    const [lowNewState, highNewState] = [
      open(state, getTestSubtopicLow(state).id),
      open(state, getTestSubtopicHigh(state).id),
    ];

    describe("Precondition test", () => {
      test("Test topic has 3 items. If not, test data has changed", () => {
        expect(getTestTopic(state).children.length).toBe(3);
      });

      test("Number of subtopics in test topic is greater than the default topic pagination", () => {
        expect(getTestTopic(state).children.length).greaterThan(
          defaultTopicPagination,
        );
      });

      test("High subtopic testing idx is larger than default topic pagination", () => {
        expect(testSubtopicHighIdx).greaterThan(defaultTopicPagination);
      });

      test("Low subtopic testing idx is smaller than the default topic pagination", () => {
        expect(testSubtopicLowIdx).lessThan(defaultSubtopicPagination);
      });
    });
    test("Opening to subtopic sets topic isOpen to true", () => {
      expect(getTestTopic(state).isOpen).false;
      expect(getTestTopic(lowNewState).isOpen).true;
      expect(getTestTopic(lowNewState).isOpen).true;
    });

    describe("Opening to subtopic sets correct pagination values", () => {
      test("Sets to subtopic idx if larger than default", () => {
        expect(getTestTopic(highNewState).pagination).toBe(testSubtopicHighIdx);
      });

      test("Sets to default if smaller than default", () => {
        expect(getTestTopic(lowNewState).pagination).toBe(
          defaultTopicPagination,
        );
      });
    });
  });

  describe("Opening to claim", () => {
    const testTopicIdx = 0;
    const testSubtopicHighIdx = 2;
    const testClaimHighIdx = 4;
    const getTestTopic = (state: ReportState) => getTopic(state, testTopicIdx);
    const getTestSubtopicHigh = (state: ReportState) =>
      getSubtopic(state, testTopicIdx, testSubtopicHighIdx);

    const getTestClaim = (state: ReportState) =>
      getTestSubtopicHigh(state).children[testClaimHighIdx];

    const testState = open(state, getId(getTestClaim(state)));

    describe("Precondition tests", () => {
      test("Test claim idx is <= subtopic children length", () => {
        expect(getTestSubtopicHigh(state).children.length).greaterThanOrEqual(
          testClaimHighIdx,
        );
      });
    });

    test("Opens parent topic", () => {
      expect(getTestTopic(testState).isOpen).true;
    });

    test("Sets parent subtopic pagination correctly", () => {
      expect(getTestTopic(testState).pagination).toBe(testSubtopicHighIdx);
    });

    test("Sets subtopic pagination correctly", () => {
      expect(getTestSubtopicHigh(testState).pagination).toBe(testClaimHighIdx);
    });
  });

  describe("Error state", () => {
    test("Giving an invalid id results in an error", () => {
      const badState = open(state, "Invalid id");
      expect(badState.error).toBeTypeOf("string");
    });
  });
});
