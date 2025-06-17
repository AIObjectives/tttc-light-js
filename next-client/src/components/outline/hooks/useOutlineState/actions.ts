import { ValueOf } from "next/dist/shared/lib/constants";
import {
  TopicPath,
  SubtopicPath,
  TaggedSubtopicPath,
  TaggedTopicPath,
} from "./types";

//  ********************************
//  * Action stream reducer *
//  *
//  * We break down every action in the main reducer into a set of smaller actions
//  * to simplify it.
//  ********************************/

const makeTopicAction =
  <T extends string>(literal: T) =>
  (payload: TopicPath) => ({
    type: literal,
    payload: payload,
  });

const makeSubtopicAction =
  <T extends string>(literal: T) =>
  (payload: SubtopicPath) => ({
    type: literal,
    payload: payload,
  });

export const actionStreamActions = {
  // topic actions
  openTopic: makeTopicAction("openTopic" as const),
  closeTopic: makeTopicAction("closeTopic" as const),
  toggleTopic: makeTopicAction("toggleTopic" as const),
  highlightTopic: makeTopicAction("highlightTopic" as const),
  unhighlightTopic: makeTopicAction("unhighlightTopic" as const),

  // subtopic actions
  highlightSubtopic: makeSubtopicAction("highlightSubtopic" as const),
  unhighlightSubtopic: makeSubtopicAction("unhighlightSubtopic" as const),

  // highlights
  setCachedHiglightPath: (payload: TaggedTopicPath | TaggedSubtopicPath) => ({
    type: "setCachedHighlightPath" as const,
    payload: payload,
  }),
  clearCachedHighlightPath: () => ({
    type: "clearCachedHighlightPath" as const,
  }),
};

export type ActionStreamActions = ReturnType<
  ValueOf<typeof actionStreamActions>
>;
