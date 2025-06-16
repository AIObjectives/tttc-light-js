import { pipe, Array, Record } from "effect";
import { OutlineState, TaggedSubtopicPath, TaggedTopicPath } from "./types";

/**
 * Maps outline ids to their location in the outline state
 */
export const mapIdsToPath = (
  state: OutlineState,
): Record<string, TaggedTopicPath | TaggedSubtopicPath> => {
  const idMap: Record<string, TaggedTopicPath | TaggedSubtopicPath> = {};
  state.tree.forEach((topic, i) => {
    idMap[topic.id] = { type: "topic", topicIdx: i };
    topic.children.forEach((subtopic, j) => {
      idMap[subtopic.id] = { type: "subtopic", topicIdx: i, subtopicIdx: j };
    });
  });
  return idMap;
};
