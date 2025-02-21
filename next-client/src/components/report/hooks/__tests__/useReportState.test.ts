import { beforeAll, describe, expect, test } from "vitest";
import { __internals, ReportState } from "../useReportState";
import { reportData } from "stories/data/dummyData";

const { stateBuilder } = __internals;

const state = stateBuilder(reportData.topics);

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

// gets the very last subtopic in the last topic
const getLastSubtopic = (state: ReportState) =>
  getLastTopic(state).children[getLastTopic(state).children.length - 1];

beforeAll(() => {
  if (state.children.length < 3) {
    throw new Error(
      "Get a larger test dataset for useReportState. Num of topics is below 3",
    );
  }
});

describe("Test Tools", () => {
  test("getTopic", () => {
    expect(getTopic(state).data.title).toBe("Medical AI");
  });

  test("getLastTopic", () => {
    expect(getLastTopic(state).data.title).toBe(
      "Future Prospects and Challenges",
    );
  });

  test("getMiddleTopic", () => {
    expect(getMiddleTopic(state).data.title).toBe("Technology and Challenges");
  });

  test("getSubtopic", () => {
    expect(getSubtopic(state).data.title).toBe("Medical AI applications");
  });

  test("getLastSubtopic", () => {
    expect(getLastSubtopic(state).data.title).toBe("Activities and Feedback");
  });
});
