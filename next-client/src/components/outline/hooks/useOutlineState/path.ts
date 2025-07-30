import { pipe, Array, Record } from "effect";
import { OutlineState, TaggedSubtopicPath, TaggedTopicPath } from "./types";
import { ReportState } from "@/components/report/hooks/useReportState";

/**
 * Maps outline ids to their location in the outline state
 */
export const mapIdsToPath = (
  reportState: ReportState,
): Record<string, TaggedTopicPath | TaggedSubtopicPath> => {
  const idMap: Record<string, TaggedTopicPath | TaggedSubtopicPath> = {};
  reportState.children.forEach((topic, i) => {
    idMap[topic.id] = { type: "topic", topicIdx: i };
    topic.children.forEach((subtopic, j) => {
      const subtopicPath = {
        type: "subtopic",
        topicIdx: i,
        subtopicIdx: j,
      } as TaggedSubtopicPath;
      idMap[subtopic.id] = subtopicPath;
      subtopic.children.forEach((claim) => {
        idMap[claim.id] = subtopicPath;
      });
    });
  });
  return idMap;
};
