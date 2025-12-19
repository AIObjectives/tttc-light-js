import { Record } from "effect";
import { describe, expect, test } from "vitest";
import { mapIdsToPath } from "../path";
import { setupTestState } from "./testStateSetup";

const { state } = setupTestState();
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
          const topic = state.children[entry.topicIdx];
          expect(topic.id).toBe(id);
        } else if (entry.type === "subtopic") {
          const subtopic =
            state.children[entry.topicIdx].children[entry.subtopicIdx];
          expect(subtopic.id).toBe(id);
        } else if (entry.type === "claim") {
          const claim =
            state.children[entry.topicIdx].children[entry.subtopicIdx].children[
              entry.claimIdx
            ];
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
