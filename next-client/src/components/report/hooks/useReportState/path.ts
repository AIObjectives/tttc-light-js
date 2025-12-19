import type { Record } from "effect";
import type { ReportState } from "./types";

//  ********************************
//  * PATH FINDING *
//  *
//  * Instead of searching through the full tree for a node every time we want find one,
//  * we build a map: node id -> Path
//  * Each Path should be tagged with a type, and contain an object that has the indices that lead there.
//  ********************************/

export type TopicPath = { topicIdx: number };
export type TaggedTopicPath = TopicPath & { type: "topic" };

export type SubtopicPath = {
  topicIdx: number;
  subtopicIdx: number;
};
export type TaggedSubtopicPath = SubtopicPath & { type: "subtopic" };
export type ClaimPath = {
  topicIdx: number;
  subtopicIdx: number;
  claimIdx: number;
};
export type TaggedClaimPath = ClaimPath & { type: "claim" };

/**
 * Takes the state and maps every id to a Path
 *
 * Returns a Record id -> (TopicPath | SubtopicPath | ClaimPath)
 */
export const mapIdsToPath = (
  state: ReportState,
): Record<string, TaggedTopicPath | TaggedSubtopicPath | TaggedClaimPath> => {
  const idMap: Record<
    string,
    TaggedTopicPath | TaggedSubtopicPath | TaggedClaimPath
  > = {};
  state.children.forEach((topic, i) => {
    idMap[topic.id] = { type: "topic", topicIdx: i };
    topic.children.forEach((subtopic, j) => {
      idMap[subtopic.id] = { type: "subtopic", topicIdx: i, subtopicIdx: j };
      subtopic.children.forEach((claim, k) => {
        idMap[claim.id] = {
          type: "claim",
          topicIdx: i,
          subtopicIdx: j,
          claimIdx: k,
        };
      });
    });
  });
  return idMap;
};
