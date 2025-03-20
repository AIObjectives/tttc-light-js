import { pipe, Array, Record } from "effect";
import { ReportState } from "./types";

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
): Record<string, TaggedTopicPath | TaggedSubtopicPath | TaggedClaimPath> =>
  pipe(
    state.children,
    // Create entries for top-level topics
    Array.reduce(
      {} as Record<string, TaggedTopicPath | TaggedSubtopicPath>,
      (idxMap, current, i) =>
        pipe(
          idxMap,
          // Add entry for current topic
          Record.set(current.id, {
            type: "topic",
            topicIdx: i,
          } as TaggedTopicPath),
          // Add entries for all subtopics
          (idxMap) =>
            pipe(
              current.children,
              Array.reduce(idxMap, (subtopicAccum, subtopic, j) =>
                pipe(
                  subtopicAccum,
                  Record.set(subtopic.id, {
                    type: "subtopic",
                    topicIdx: i,
                    subtopicIdx: j,
                  } as TaggedSubtopicPath),
                  // add entries for all claims
                  (idxMap) =>
                    pipe(
                      subtopic.children,
                      Array.reduce(idxMap, (claimAccum, claim, k) =>
                        pipe(
                          claimAccum,
                          Record.set(claim.id, {
                            type: "claim",
                            topicIdx: i,
                            subtopicIdx: j,
                            claimIdx: k,
                          } as TaggedClaimPath),
                        ),
                      ),
                    ),
                ),
              ),
            ),
        ),
    ),
  );
