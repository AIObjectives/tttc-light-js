import { Match } from "effect";
import { type ActionStreamActions, Actions, type MapActions } from "./actions";
import type {
  TaggedClaimPath,
  TaggedSubtopicPath,
  TaggedTopicPath,
} from "./path";

//  ********************************
//  * CREATE ACTION STREAMS *
//  *
//  * Translates a report state action into a series of action stream reducer actions.
//  * These should each handle every possible case.
//  ********************************/

/**
 * Action stream actions for "Open"
 */
const open = Match.type<
  TaggedTopicPath | TaggedSubtopicPath | TaggedClaimPath
>().pipe(
  /**
   * When the node is a topic node, just open it
   */
  Match.when({ type: "topic" }, (path): ActionStreamActions[] => [
    Actions.openTopic(path),
  ]),
  /**
   * When the node is a subtopic node:
   * - open the parent topic node
   * - set the topic pagination so the subtopic is visible
   */
  Match.when({ type: "subtopic" }, (path): ActionStreamActions[] => [
    Actions.openTopic(path),
    Actions.setTopicPagination({ path: path, pag: path.subtopicIdx }),
  ]),
  /**
   * When the node is a claim node:
   * - Open the parent topic
   * - Set the parent topic's pagination so the parent subtopic is is visible
   * - Set the parent subtopic's pagination is the claim is visible.
   */
  Match.when({ type: "claim" }, (path): ActionStreamActions[] => [
    Actions.openTopic(path),
    Actions.setTopicPagination({ path, pag: path.subtopicIdx }),
    Actions.setSubtopicPagination({ path, pag: path.claimIdx }),
  ]),
  Match.exhaustive,
);

/**
 * Action stream actions for "close"
 */
const close = Match.type<TaggedTopicPath>().pipe(
  /**
   * When the node is a topic node:
   * - Close the topic
   * - Reset the topic pagination
   * - Reset the subtopic pagination
   */
  Match.when(
    { type: "topic" },
    (path): (ActionStreamActions | MapActions)[] => [
      Actions.closeTopic(path),
      Actions.resetTopicPagination(path),
      Actions.mapActionToTopicsChildren(path)(Actions.resetSubtopicPagination),
    ],
  ),
  Match.exhaustive,
);

/**
 * Action stream actions for "openAll"
 *
 * Since this action doesn't need a path, we can just return an array of map actions
 */
const openAll: MapActions[] = [
  // Open topics
  Actions.mapActionToAllTopics(Actions.openTopic),
  // Set topic pagination to max
  Actions.mapActionToAllTopics(Actions.maxSetTopicPagination),
  // Set subtopic pagination to max
  Actions.mapActionToAllSubtopics(Actions.maxSetSubtopicPagination),
];

/**
 * Action stream actions for "closeAll"
 *
 * Since this action doesn't need a path, we can just return an array of map actions
 */
const closeAll: MapActions[] = [
  // close topics
  Actions.mapActionToAllTopics(Actions.closeTopic),
  // reset topic pagination
  Actions.mapActionToAllTopics(Actions.resetTopicPagination),
  // reset subtopic pagination
  Actions.mapActionToAllSubtopics(Actions.resetSubtopicPagination),
];

/**
 * Action stream actions for "expandTopic" and "expandSubtopic"
 */
const incrementPagination = Match.type<
  TaggedTopicPath | TaggedSubtopicPath
>().pipe(
  Match.discriminators("type")({
    topic: (path) => [Actions.incrementTopicPagination(path)],
    subtopic: (path) => [Actions.incrementSubtopicPagination(path)],
  }),
  Match.exhaustive,
);

export const ActionStream = {
  open,
  close,
  openAll,
  closeAll,
  incrementPagination,
};
