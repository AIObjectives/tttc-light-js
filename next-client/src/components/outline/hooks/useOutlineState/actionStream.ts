import { Match } from "effect";
import { actionStreamActions } from "./actions";
import type { TaggedSubtopicPath, TaggedTopicPath } from "./types";
//  ********************************
//  * Action stream creators *
//  *
//  * For each action, we want to create a set of actions for the action stream reducer
//  ********************************/

/**
 * Actions stream actions for "open"
 */
export const createOpenActionStream = Match.type<
  TaggedTopicPath | TaggedSubtopicPath
>().pipe(
  Match.when({ type: "topic" }, (path) => [
    actionStreamActions.openTopic(path),
  ]),
  /**
   * When we get the open action for subtopics, we should make sure the topic
   * in the outline is open, but other than that there's nothing to do
   */
  Match.when({ type: "subtopic" }, (path) => [
    actionStreamActions.openTopic({ topicIdx: path.topicIdx }),
  ]),
  Match.exhaustive,
);

/**
 * Action stream actions for "close"
 */
export const createCloseActionStream = Match.type<TaggedTopicPath>().pipe(
  Match.when({ type: "topic" }, (path) => [
    actionStreamActions.closeTopic(path),
  ]),
  Match.exhaustive,
);

/**
 * Action stream actions for "toggle"
 */
export const createToggleActionStream = Match.type<TaggedTopicPath>().pipe(
  Match.when({ type: "topic" }, (path) => [
    actionStreamActions.toggleTopic(path),
  ]),
  Match.exhaustive,
);

/**
 * Action stream actions for "highlight"
 *
 * Note: We use this with the unmatch creator for simplicity
 */
export const createHighlightedActionStream = Match.type<
  TaggedTopicPath | TaggedSubtopicPath
>().pipe(
  /**
   * When highlighting a node, set the node's isHighlight to true and
   * then set path to the cache
   */
  Match.when({ type: "topic" }, (path) => [
    actionStreamActions.highlightTopic(path),
    actionStreamActions.setCachedHiglightPath(path),
  ]),
  Match.when({ type: "subtopic" }, (path) => [
    actionStreamActions.highlightSubtopic(path),
    actionStreamActions.setCachedHiglightPath(path),
  ]),
  Match.exhaustive,
);

export const createUnhighlightedActionStream = Match.type<
  TaggedTopicPath | TaggedSubtopicPath | null
>().pipe(
  /**
   * When unhighlighting, set the node's isHighlight:false and clear the cached path
   */
  Match.when({ type: "topic" }, (path) => [
    actionStreamActions.unhighlightTopic(path),
    actionStreamActions.clearCachedHighlightPath(),
  ]),
  Match.when({ type: "subtopic" }, (path) => [
    actionStreamActions.unhighlightSubtopic(path),
    actionStreamActions.clearCachedHighlightPath(),
  ]),
  Match.when(Match.null, () => []),
  Match.exhaustive,
);
