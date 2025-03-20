import { ValueOf } from "next/dist/shared/lib/constants";
import { SubtopicPath, TopicPath } from "./path";
import { ReportState } from "./types";

//  ********************************
//  * ACTION STREAM ACTIONS *
//  *
//  * Actions and action creators for the Action Stream Reducer
//  ********************************/

const makeTopicAction =
  <T extends string>(typeliteral: T) =>
  (payload: TopicPath) => ({
    type: typeliteral,
    payload,
  });

const makeSubtopicAction =
  <T extends string>(typeliteral: T) =>
  (payload: SubtopicPath) => ({
    type: typeliteral,
    payload,
  });

const actionsStreamActions = {
  // Topic Actions
  openTopic: makeTopicAction("openTopic" as const),
  closeTopic: makeTopicAction("closeTopic" as const),
  resetTopicPagination: makeTopicAction("resetTopicPagination" as const),
  maxSetTopicPagination: makeTopicAction("maxSetTopicPagination" as const),
  incrementTopicPagination: makeTopicAction(
    "incrementTopicPagination" as const,
  ),
  setTopicPagination: (payload: { path: TopicPath; pag: number }) => ({
    type: "setTopicPagination" as const,
    payload,
  }),
  // Subtopic Actions
  resetSubtopicPagination: makeSubtopicAction(
    "resetSubtopicPagination" as const,
  ),
  maxSetSubtopicPagination: makeSubtopicAction(
    "maxSetSubTopicPagination" as const,
  ),
  incrementSubtopicPagination: makeSubtopicAction(
    "incrementSubtopicPagination" as const,
  ),
  setSubtopicPagination: (payload: { path: SubtopicPath; pag: number }) => ({
    type: "setSubtopicPagination" as const,
    payload,
  }),
};

export type ActionStreamActions = ReturnType<
  ValueOf<typeof actionsStreamActions>
>;

/**
 * Helper type for matching a union to a subset based on an exact match. Made since
 * Extract<T,U> will include supersets
 */
type Exact<T, Shape> = T extends Shape ? (Shape extends T ? T : never) : never;

/**
 * Topic actions where the payload is just a Path
 */
type TopicActionsWithPath = Exact<
  ActionStreamActions,
  { type: any; payload: TopicPath }
>;

/**
 * Subtopic actions where the payload is just a path
 */
type SubtopicActionsWithPath = Exact<
  ActionStreamActions,
  { type: any; payload: SubtopicPath }
>;

//  ********************************
//  * SPECIAL ACTION CONSTRUCTORS  *
//  *
//  * Usually, state = action(state). However, sometimes we need to derive our actions from state such that actions = f(state).
//  * This way we can do things like changing a particular node that meets some condition, or change every node.
//  ********************************/

/**
 * Special type of action that generates an array of actions. Used for situations where we want to
 * map one of our other actions, like opening all topics.
 */
export type MapActions = {
  type: "mapActions";
  payload: (state: ReportState) => ActionStreamActions[];
};

/**
 * Creates a special action MapActions. It takes a function that returns an array of ActionStreamActions
 *
 * Useful for things like mapping across every topic or subtopic.
 */
const mapStateToActions = (
  f: (state: ReportState) => ActionStreamActions[],
): MapActions => ({
  type: "mapActions",
  payload: f,
});

/**
 * Maps an action to every topic in state. Takes an action creator Path -> Action
 */
const mapActionToAllTopics = (
  actionCreator: (payload: TopicPath) => TopicActionsWithPath,
): MapActions =>
  mapStateToActions((state) =>
    state.children.map((_, topicIdx) => actionCreator({ topicIdx })),
  );

/**
 * Maps an action to every subtopic in state. Takes an action creator Path -> Action
 */
const mapActionToAllSubtopics = (
  actionCreator: (payload: SubtopicPath) => SubtopicActionsWithPath,
): MapActions =>
  mapStateToActions((state) =>
    state.children.flatMap((t, topicIdx) =>
      t.children.map((_, subtopicIdx) =>
        actionCreator({ topicIdx, subtopicIdx }),
      ),
    ),
  );

/**
 * Maps an action to the subtopics within a particular topic. Takes an action creator Path -> Action
 */
const mapActionToTopicsChildren =
  (topicPath: TopicPath) =>
  (
    actionCreator: (payload: SubtopicPath) => SubtopicActionsWithPath,
  ): MapActions =>
    mapStateToActions((state) =>
      state.children[topicPath.topicIdx].children.flatMap((_, subtopicIdx) =>
        actionCreator({ ...topicPath, subtopicIdx }),
      ),
    );

export const Actions = {
  ...actionsStreamActions,
  mapActionToAllTopics,
  mapActionToAllSubtopics,
  mapActionToTopicsChildren,
};
