import { describe, test, expect } from "vitest";
import { ReportState, SomeNode, __internals } from "../useReportState";
import { reportData } from "stories/data/dummyData";
import { Record } from "effect";
const { reducer, stateBuilder, mapIdsToPath } = __internals;

const state = stateBuilder(reportData.topics);

describe("Utility functions", () => {
  describe("mapIdsToPath", () => {
    test("Id map builds without error", () => {
      expect(() => mapIdsToPath(state)).not.toThrow();
    });

    test("Id map maps to correct values", () => {
      const idMap = mapIdsToPath(state);
      for (const id of Record.keys(idMap)) {
        const entry = idMap[id];
        if (entry.type === "topic") {
          const topic = state.children[entry.path.topicIdx];
          expect(topic.id).toBe(id);
        } else if (entry.type === "subtopic") {
          const subtopic =
            state.children[entry.path.topicIdx].children[
              entry.path.subtopicIdx
            ];
          expect(subtopic.id).toBe(id);
        } else if (entry.type === "claim") {
          const claim =
            state.children[entry.path.topicIdx].children[entry.path.subtopicIdx]
              .children[entry.path.claimIdx];
          expect(claim.id).toBe(id);
        }
      }
    });

    test("Id map's values are all unique", () => {
      const idMap = mapIdsToPath(state);
      const size = Record.size(idMap);
      const setKeys = new Set(Record.keys(idMap));
      expect(setKeys.size).toBe(size);
    });
  });
});
