import { describe, expect, test } from "vitest";
import type { ReportState } from "../types";
import { setupTestState } from "./testStateSetup";

const { state, reducer } = setupTestState();

const open = (reportState: ReportState) =>
  reducer(reportState, { type: "openAll" });

const openedState = open(state);

describe("TopicNode properties", () => {
  test("All topics are open", () => {
    expect(openedState.children.every((t) => t.isOpen)).true;
  });

  test("Pagination set to match number of children", () => {
    expect(openedState.children.map((t) => t.children.length - 1)).toEqual(
      openedState.children.map((t) => t.pagination),
    );
  });
});

describe("SubtopicNode properties", () => {
  test("All subtopics are set to match their number of children", () => {
    const subtopics = openedState.children.flatMap((t) => t.children);
    subtopics.forEach((node) =>
      expect(node.pagination).toBe(node.children.length - 1),
    );
  });
});
