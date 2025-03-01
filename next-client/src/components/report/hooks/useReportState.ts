"use client";

import { Dispatch, useReducer } from "react";
import { getNPeople } from "tttc-common/morphisms";

import * as schema from "tttc-common/schema";

import { Option, pipe, Array, Either, flow, Match, Record } from "effect";

/**
 * @fileoverview
 * This manages the state of the report. Things like pagination, whether the report is open, etc.
 *
 * Overview: This module exposes a useReportState function, which returns state and dispatch
 *
 * When an action is dispatched, we break up the action into a bunch of sub actions, and
 * apply those actions to the state.
 */

//  ********************************
//  * CONSTS
//  ********************************/

// Pagination is 0 indexed, so 0 will show one
const defaultTopicPagination = 2;
const defaultAddTopicPagination = 1;

const defaultSubtopicPagination = 2;
const defaultAddSubtopicPagination = 3;

//  ********************************
//  * NODE / STATE DEFINITIONS
//  ********************************/

/**
 * Report State - highest level implementation
 */
export type ReportState = {
  children: TopicNode[];
  focusedId: string | null;
  error: string | null;
};

/**
 * A single Node in the NodeTree. Wraps data.
 */
export type Node<T> = {
  id: string;
  data: Readonly<T>;
};

/**
 * Nodes with Topics as data
 */
export type TopicNode = Node<schema.Topic> & {
  readonly _tag: "TopicNode";
  children: SubtopicNode[];
  isOpen: boolean;
  pagination: number;
};

/**
 * Nodes with Subtopic as data
 */
export type SubtopicNode = Node<schema.Subtopic> & {
  readonly _tag: "SubtopicNode";
  children: ClaimNode[];
  pagination: number;
};

/**
 * Nodes with Claims as data
 */
export type ClaimNode = Node<schema.Claim> & {
  readonly _tag: "ClaimNode";
};

/**
 * Union of all nodes
 */
export type SomeNode = TopicNode | SubtopicNode | ClaimNode;

//  ********************************
//  * PATH FINDING *
//  *
//  * Instead of searching through the full tree for a node every time we want find one,
//  * we build a map: node id -> Path
//  * Each Path should be tagged with a type, and contain an object that has the indices that lead there.
//  ********************************/

type TopicPath = { topicIdx: number };
type TaggedTopicPath = TopicPath & { type: "topic" };

type SubtopicPath = {
  topicIdx: number;
  subtopicIdx: number;
};
type TaggedSubtopicPath = SubtopicPath & { type: "subtopic" };
type ClaimPath = {
  topicIdx: number;
  subtopicIdx: number;
  claimIdx: number;
};
type TaggedClaimPath = ClaimPath & { type: "claim" };

/**
 * Takes the state and maps every id to a Path
 *
 * Returns a Record id -> (TopicPath | SubtopicPath | ClaimPath)
 */
const mapIdsToPath = (
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

//  ********************************
//  * ACTION STREAM ACTIONS *
//  *
//  * Actions and action creators for the Action Stream Reducer
//  ********************************/

type OpenTopicAction = {
  type: "openTopic";
  payload: TopicPath;
};

type CloseTopicAction = {
  type: "closeTopic";
  payload: TopicPath;
};

type ToggleTopicAction = {
  type: "toggleTopic";
  payload: TopicPath;
};

type ResetTopicPagination = {
  type: "resetTopicPagination";
  payload: TopicPath;
};

type SetTopicPagination = {
  type: "setTopicPagination";
  payload: { path: TopicPath; pag: number };
};

type MaxSetTopicPagination = {
  type: "maxSetTopicPagination";
  payload: TopicPath;
};

type IncrementTopicPagination = {
  type: "incrementTopicPagination";
  payload: TopicPath;
};

type ResetSubtopicPagination = {
  type: "resetSubtopicPagination";
  payload: SubtopicPath;
};

type SetSubtopicPagination = {
  type: "setSubtopicPagination";
  payload: { path: SubtopicPath; pag: number };
};

type MaxSetSubtopicPagination = {
  type: "maxSetSubTopicPagination";
  payload: SubtopicPath;
};

type IncrementSubtopicPagination = {
  type: "incrementSubtopicPagination";
  payload: SubtopicPath;
};

type ActionStreamActions =
  | OpenTopicAction
  | CloseTopicAction
  | ResetTopicPagination
  | SetTopicPagination
  | MaxSetTopicPagination
  | IncrementTopicPagination
  | ToggleTopicAction
  | ResetSubtopicPagination
  | SetSubtopicPagination
  | MaxSetSubtopicPagination
  | IncrementSubtopicPagination;

/**
 * Special type of action that generates an array of actions. Used for situations where we want to
 * map one of our other actions, like opening all topics.
 */
type MapActions = {
  type: "mapActions";
  payload: (state: ReportState) => ActionStreamActions[];
};

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

/**
 * Makes a function that returns a TopicActionsWithPath. Just makes it easier to define our actions
 * since most just take a path
 */
const createTopicActionsWithPath = <T extends TopicActionsWithPath>(
  types: T["type"][],
) =>
  types.map(
    (type) =>
      (payload: TopicPath): TopicActionsWithPath => ({
        type,
        payload,
      }),
  );

/**
 * Makes a function that returns a SubtopicActionsWithPath. Just makes it easier to define our actions
 * since most just take a path
 */
const createSubtopicActionsWithPath = <T extends SubtopicActionsWithPath>(
  types: T["type"][],
) =>
  types.map((type) => (payload: SubtopicPath) => ({
    type,
    payload,
  }));

/**
 * Topic actions that just have a path payload
 */
const [
  openTopicAction,
  closeTopicAction,
  toggleTopicAction,
  resetTopicPagAction,
  maxSetTopicPagAction,
  incrementTopicPagAction,
] = createTopicActionsWithPath([
  "openTopic",
  "closeTopic",
  "toggleTopic",
  "resetTopicPagination",
  "maxSetTopicPagination",
  "incrementTopicPagination",
]);

/**
 * Sets the topic pagination to an arbitrary value.
 */
const setTopicPagAction = (payload: {
  path: TopicPath;
  pag: number;
}): SetTopicPagination => ({
  type: "setTopicPagination",
  payload,
});

/**
 * Subtopic actions that just have a path payload
 */
const [
  resetSubtopicPagAction,
  maxSetSubtopicPagAction,
  incrementSubtopicPagination,
] = createSubtopicActionsWithPath([
  "resetSubtopicPagination",
  "maxSetSubTopicPagination",
  "incrementSubtopicPagination",
]);

/**
 * Sets the subtopic pagination to an arbitrary value
 */
const setSubTopicPagAction = (payload: {
  path: SubtopicPath;
  pag: number;
}): SetSubtopicPagination => ({
  type: "setSubtopicPagination",
  payload,
});

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

//  ********************************
//  * ACTION STREAM REDUCER *
//  *
//  * We want to break down actions from the report state reducer into a series of smaller
//  * more maintainable actions.
//  ********************************/

function actionStreamReducer(
  state: ReportState,
  { type, payload }: ActionStreamActions | MapActions,
): ReportState {
  switch (type) {
    /**
     * Sets topic to open
     */
    case "openTopic": {
      // return openTopic(state, payload);
      return modifyTopic((node) => ({ ...node, isOpen: true }))(state, payload);
    }
    /**
     * Sets topic to closed
     */
    case "closeTopic": {
      return modifyTopic((node) => ({ ...node, isOpen: false }))(
        state,
        payload,
      );
    }
    /**
     * Flips between topic being open and closed
     */
    case "toggleTopic": {
      return modifyTopic((node) => ({ ...node, isOpen: !node.isOpen }))(
        state,
        payload,
      );
    }
    /**
     * Resets a topic's pagination back to either its default or children len, whichever is smaller
     */
    case "resetTopicPagination": {
      return modifyTopic(topicNodePagSetter(defaultTopicPagination))(
        state,
        payload,
      );
    }
    /**
     * Sets a topic's pagination to its maximal value.
     */
    case "maxSetTopicPagination": {
      return modifyTopic((node) => ({
        ...node,
        pagination: node.children.length - 1,
      }))(state, payload);
    }
    /**
     * Set's a topic's pagination to an arbitrary value.
     */
    case "setTopicPagination": {
      return modifyTopic(topicNodePagSetter(payload.pag))(state, payload.path);
    }
    /**
     * Increments a topic's pagination by a set amount
     */
    case "incrementTopicPagination": {
      return modifyTopic((node) =>
        topicNodePagSetter(node.pagination + defaultAddTopicPagination)(node),
      )(state, payload);
    }
    /**
     * Sets a subtopic's pagination to its default or children len, whichever is smaller
     */
    case "resetSubtopicPagination": {
      return modifySubtopic(subtopicNodePagSetter(defaultSubtopicPagination))(
        state,
        payload,
      );
    }
    /**
     * Increases a subtopic's pagination by a set amount
     */
    case "incrementSubtopicPagination": {
      return modifySubtopic((node) =>
        subtopicNodePagSetter(node.pagination + defaultAddSubtopicPagination)(
          node,
        ),
      )(state, payload);
    }
    /**
     * Sets a subtopic's pagination to an arbitrary value.
     */
    case "setSubtopicPagination": {
      return modifySubtopic(subtopicNodePagSetter(payload.pag))(
        state,
        payload.path,
      );
    }
    /**
     * Sets a subtopic's pagination to its maximal value
     */
    case "maxSetSubTopicPagination": {
      return modifySubtopic((node) => ({
        ...node,
        pagination: node.children.length - 1,
      }))(state, payload);
    }
    /**
     * A special action that generates an array of actions based on the state and calls actionStreamReducer again.
     * Used for things like mapping an action over every topic or subtopic.
     *
     * Since the function given to this returns only ActionStreamActions without MapActions, we will avoid infinite recursion.
     */
    case "mapActions": {
      return pipe(
        state,
        // The payload of this action is a function: ReportState -> ActionStream[]
        payload,
        // Reduce ActionStream[] over the actionStreamReducer.
        Array.reduce(state, actionStreamReducer),
      );
    }
  }
}

//  ********************************
//  * ACTION STREAM HELPER FUNCTIONS *
//  ********************************/

/**
 * Guards against setting a node's pagination above its children length or below its default pag
 */
const nodePaginationSetter =
  (defaultSize: number) =>
  (pag: number) =>
  <T extends TopicNode | SubtopicNode>(node: T) => {
    // Should never go below default size unless its children length is smaller
    const lowerbound = Math.min(defaultSize, node.children.length - 1);
    return {
      ...node,
      // Should never bo below lower bound or above max children index
      pagination: Math.min(Math.max(pag, lowerbound), node.children.length - 1),
    };
  };

/**
 * For setting topic node pag
 */
const topicNodePagSetter = nodePaginationSetter(defaultTopicPagination);
/**
 * For setting subtopic node pag
 */
const subtopicNodePagSetter = nodePaginationSetter(defaultSubtopicPagination);

/**
 * Used in action stream reducer for modifying a particular topic node
 */
const modifyTopic =
  (f: (node: TopicNode) => TopicNode) =>
  (state: ReportState, path: TopicPath): ReportState =>
    pipe(state.children, Array.modify(path.topicIdx, f), (children) => ({
      ...state,
      children,
    }));

/**
 * Used in action stream reducer for modifying a particular subtopic node.
 */
const modifySubtopic =
  (f: (node: SubtopicNode) => SubtopicNode) =>
  (state: ReportState, path: SubtopicPath): ReportState =>
    modifyTopic((topicNode) => ({
      ...topicNode,
      children: Array.modify(topicNode.children, path.subtopicIdx, f),
    }))(state, path);

//  ********************************
//  * CREATE ACTION STREAMS *
//  *
//  * Translates a report state action into a series of action stream reducer actions.
//  * These should each handle every possible case.
//  ********************************/

/**
 * Action stream actions for "Open"
 */
const createOpenActionStream = Match.type<
  TaggedTopicPath | TaggedSubtopicPath | TaggedClaimPath
>().pipe(
  /**
   * When the node is a topic node, just open it
   */
  Match.when({ type: "topic" }, (path): ActionStreamActions[] => [
    openTopicAction(path),
  ]),
  /**
   * When the node is a subtopic node:
   * - open the parent topic node
   * - set the topic pagination so the subtopic is visible
   */
  Match.when({ type: "subtopic" }, (path): ActionStreamActions[] => [
    openTopicAction(path),
    setTopicPagAction({ path: path, pag: path.subtopicIdx }),
  ]),
  /**
   * When the node is a claim node:
   * - Open the parent topic
   * - Set the parent topic's pagination so the parent subtopic is is visible
   * - Set the parent subtopic's pagination is the claim is visible.
   */
  Match.when({ type: "claim" }, (path): ActionStreamActions[] => [
    openTopicAction(path),
    setTopicPagAction({ path, pag: path.subtopicIdx }),
    setSubTopicPagAction({ path, pag: path.claimIdx }),
  ]),
  Match.exhaustive,
);

/**
 * Action stream actions for "close"
 */
const createCloseActionStream = Match.type<TaggedTopicPath>().pipe(
  /**
   * When the node is a topic node:
   * - Close the topic
   * - Reset the topic pagination
   * - Reset the subtopic pagination
   */
  Match.when(
    { type: "topic" },
    (path): (ActionStreamActions | MapActions)[] => [
      closeTopicAction(path),
      resetTopicPagAction(path),
      mapActionToTopicsChildren(path)(resetSubtopicPagAction),
    ],
  ),
  Match.exhaustive,
);

/**
 * Action stream actions for "openAll"
 *
 * Since this action doesn't need a path, we can just return an array of map actions
 */
const openAllActionStream: MapActions[] = [
  // Open topics
  mapActionToAllTopics(openTopicAction),
  // Set topic pagination to max
  mapActionToAllTopics(maxSetTopicPagAction),
  // Set subtopic pagination to max
  mapActionToAllSubtopics(maxSetSubtopicPagAction),
];

/**
 * Action stream actions for "closeAll"
 *
 * Since this action doesn't need a path, we can just return an array of map actions
 */
const closeAllActionStream: MapActions[] = [
  // close topics
  mapActionToAllTopics(closeTopicAction),
  // reset topic pagination
  mapActionToAllTopics(resetTopicPagAction),
  // reset subtopic pagination
  mapActionToAllSubtopics(resetSubtopicPagAction),
];

/**
 * Action stream actions for "expandTopic" and "expandSubtopic"
 */
const createIncrementActionStream = Match.type<
  TaggedTopicPath | TaggedSubtopicPath
>().pipe(
  Match.discriminators("type")({
    topic: (path) => [incrementTopicPagAction(path)],
    subtopic: (path) => [incrementSubtopicPagination(path)],
  }),
  Match.exhaustive,
);

//  ********************************
//  * STATE BUILDERS *
//  ********************************/

/**
 * Builds the report state from a list of topics
 */
const stateBuilder = (topics: schema.Topic[]): ReportState => ({
  children: topics
    .map(makeTopicNode)
    .sort((a, b) => getNPeople([b.data]) - getNPeople([a.data])),
  focusedId: null,
  error: null,
});

const makeTopicNode = (topic: schema.Topic): TopicNode => ({
  _tag: "TopicNode",
  id: topic.id,
  data: topic,
  isOpen: false,
  pagination: Math.min(topic.subtopics.length - 1, defaultTopicPagination),
  children: topic.subtopics
    .map(makeSubtopicNode)
    .sort((a, b) => getNPeople([b.data]) - getNPeople([a.data])),
});

const makeSubtopicNode = (subtopic: schema.Subtopic): SubtopicNode => ({
  _tag: "SubtopicNode",
  id: subtopic.id,
  data: subtopic,
  pagination: Math.min(subtopic.claims.length - 1, defaultSubtopicPagination),
  children: subtopic.claims.map(makeClaimNode),
});

const makeClaimNode = (claim: schema.Claim): ClaimNode => ({
  _tag: "ClaimNode",
  id: claim.id,
  data: claim,
});

//  ********************************
//  * REPORT STATE REDUCER *
//  ********************************/

type ReportStateActionTypesWithIdPayloads =
  | "open"
  | "close"
  | "toggleTopic"
  | "expandTopic"
  | "expandSubtopic"
  | "focus";

type ReportStateActionTypesWithoutPayloads =
  | "openAll"
  | "closeAll"
  | "clearError";

type ReportStateActionTypesWithMessages = "error";

type ReportStateActionsWithIdPayloads = {
  type: ReportStateActionTypesWithIdPayloads;
  payload: { id: string };
};

type ReportStateActionsWithoutPayloads = {
  type: ReportStateActionTypesWithoutPayloads;
};

type ReportStateActionsWithMessagePayloads = {
  type: ReportStateActionTypesWithMessages;
  payload: { message: string };
};

export type ReportStateAction =
  | ReportStateActionsWithIdPayloads
  | ReportStateActionsWithoutPayloads
  | ReportStateActionsWithMessagePayloads;

function createPathMapReducer(
  idMap: Record<string, TopicPath | SubtopicPath | ClaimPath>,
) {
  return function (state: ReportState, action: ReportStateAction): ReportState {
    switch (action.type) {
      // For open, we want the same function to work for topics or subtopics.
      // If subtopic, should open parent and set pagination to the correct value
      case "open": {
        const { id } = action.payload;
        return pipe(
          // string: Path
          idMap,
          // Some Path
          Record.get(id),
          Option.map(
            // Path
            flow(
              // Break down the action into a bunch of subactions
              // Path -> ActionStream
              createOpenActionStream,
              // and reduce over the state
              // ActionStream -> ReportState
              Array.reduce(state, actionStreamReducer),
            ),
          ),
          // If idxMap for some reason couldn't find the Path, just return the state.
          // TODO: Include more comprehensive error handling.
          Option.getOrElse(() => {
            return {
              ...state,
              error: "Could not find path to topic or subtopic",
            };
          }),
        );
      }
      case "close": {
        const { id } = action.payload;
        return pipe(
          // string: Path
          idMap,
          // Option Path
          Record.get(id),
          // Either Path
          Either.fromOption(() => "Could not find path"),
          Either.map(
            // Path
            flow(
              // Path -> ActionStream
              createCloseActionStream,
              // ActionStream -> ReportState
              Array.reduce(state, actionStreamReducer),
            ),
          ),
          // TODO: include more comprehensive error handling
          Either.getOrElse((e) => {
            return {
              ...state,
              error: e,
            };
          }),
        );
      }
      case "toggleTopic": {
        const { id } = action.payload;
        return pipe(
          idMap,
          Record.get(id),
          Either.fromOption(() => "Could not find path"),
          Either.map((path) =>
            actionStreamReducer(state, toggleTopicAction(path)),
          ),
          Either.getOrElse((e) => {
            return {
              ...state,
              error: e,
            };
          }),
        );
      }
      /**
       *
       */
      case "openAll": {
        return pipe(
          openAllActionStream,
          Array.reduce(state, actionStreamReducer),
        );
      }
      case "closeAll": {
        return pipe(
          closeAllActionStream,
          Array.reduce(state, actionStreamReducer),
        );
      }
      case "expandTopic":
      case "expandSubtopic": {
        const { id } = action.payload;
        return pipe(
          idMap,
          Record.get(id),
          Either.fromOption(
            () => "There was an error in finding the topic/subtopic to expand.",
          ),
          Either.map(
            flow(
              createIncrementActionStream,
              Array.reduce(state, actionStreamReducer),
            ),
          ),
          Either.getOrElse((e) => {
            return {
              ...state,
              error: e,
            };
          }),
        );
      }
      case "focus": {
        const { id } = action.payload;
        return {
          ...state,
          focusedId: id,
        };
      }
      case "error": {
        const { message } = action.payload;
        return {
          ...state,
          error: message,
        };
      }
      case "clearError": {
        return {
          ...state,
          error: null,
        };
      }
      default: {
        return state;
      }
    }
  };
}

/**
 * Hook for managing the state of the report
 *
 * Should only be invoked once for a report
 */
function useReportState(
  topics: schema.Topic[],
): [ReportState, Dispatch<ReportStateAction>] {
  // Builds the initial state of the report
  const initialState = stateBuilder(topics);
  // This creates a Record: string -> Path.
  const idMap = mapIdsToPath(initialState);
  // Curries the idMap into the reducer function, so we don't have to call it over and over again.
  const reducer = createPathMapReducer(idMap);
  // ReportState, ({action, payload}) => ReportState
  return useReducer(reducer, initialState);
}

export const __internals = {
  mapIdsToPath,
  createPathMapReducer,
  defaultTopicPagination,
  defaultSubtopicPagination,
  defaultAddTopicPagination,
  defaultAddSubtopicPagination,
  stateBuilder,
};

export default useReportState;
