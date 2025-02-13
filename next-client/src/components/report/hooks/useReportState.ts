"use client";

import { Dispatch, useReducer } from "react";
import { getNPeople } from "tttc-common/morphisms";

import * as schema from "tttc-common/schema";

import { Option, pipe, Array, Either, flow, Match, Record } from "effect";
import { readonlyArray } from "effect/Differ";

/**
 * @fileoverview
 * This manages the state of the report. Things like pagination, whether the report is open, etc.
 *
 * Overview: This module exposes a useReportState function, which returns state and dispatch
 *
 * When an action is dispatched, we break up the action into a bunch of sub actions, and
 * apply those actions to the state.
 */

const defaultTopicPagination = 3;
const defaultAddTopicPagination = 1;

const defaultSubtopicPagination = 3;
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
//  * ACTION STREAM REDUCER *
//  *
//  * We want to break down actions from the report state reducer into a series of smaller
//  * more maintainable actions.
//  ********************************/

type OpenTopicAction = {
  type: "openTopic";
  payload: TopicPath;
};

type CloseTopicAction = {
  type: "closeTopic";
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
  | ResetSubtopicPagination
  | SetSubtopicPagination
  | MaxSetSubtopicPagination
  | IncrementSubtopicPagination;

type MapActions = {
  type: "mapActions";
  payload: (state: ReportState) => ActionStreamActions[];
};

type Exact<T, Shape> = T extends Shape ? (Shape extends T ? T : never) : never;

type TopicActionsWithPath = Exact<
  ActionStreamActions,
  { type: any; payload: TopicPath }
>;

type SubtopicActionsWithPath = Exact<
  ActionStreamActions,
  { type: any; payload: SubtopicPath }
>;

const createTopicActionsWithPath =
  <T extends TopicActionsWithPath>(type: T["type"]) =>
  (payload: TopicPath): TopicActionsWithPath => ({
    type,
    payload,
  });

const createSubtopicActionsWithPath =
  <T extends SubtopicActionsWithPath>(type: T["type"]) =>
  (payload: SubtopicPath) => ({
    type,
    payload,
  });

const openTopicAction = createTopicActionsWithPath("openTopic");
const closeTopicAction = createTopicActionsWithPath("closeTopic");
const resetTopicPagAction = createTopicActionsWithPath("resetTopicPagination");
const maxSetTopicPagAction = createTopicActionsWithPath(
  "maxSetTopicPagination",
);
const incrementTopicPagAction = createTopicActionsWithPath(
  "incrementTopicPagination",
);

const setTopicPagAction = (payload: {
  path: TopicPath;
  pag: number;
}): SetTopicPagination => ({
  type: "setTopicPagination",
  payload,
});

const resetSubtopicPagAction = createSubtopicActionsWithPath(
  "resetSubtopicPagination",
);
const maxSetSubtopicPagAction = createSubtopicActionsWithPath(
  "maxSetSubTopicPagination",
);
const incrementSubtopicPagination = createSubtopicActionsWithPath(
  "incrementSubtopicPagination",
);

const setSubTopicPagAction = (payload: {
  path: SubtopicPath;
  pag: number;
}): SetSubtopicPagination => ({
  type: "setSubtopicPagination",
  payload,
});

const mapStateToActions = (
  f: (state: ReportState) => ActionStreamActions[],
): MapActions => ({
  type: "mapActions",
  payload: f,
});

const mapActionToAllTopics = (
  actionCreator: (payload: TopicPath) => TopicActionsWithPath,
): MapActions =>
  mapStateToActions((state) =>
    state.children.map((_, topicIdx) => actionCreator({ topicIdx })),
  );

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

function actionStreamReducer(
  state: ReportState,
  { type, payload }: ActionStreamActions | MapActions,
): ReportState {
  switch (type) {
    case "openTopic": {
      return openTopic(state, payload);
    }
    case "closeTopic": {
      return closeTopic(state, payload);
    }
    case "resetTopicPagination": {
      return resetTopicPag(state, payload);
    }
    case "maxSetTopicPagination": {
      return maxSetTopicPag(state, payload);
    }
    case "setTopicPagination": {
      return setTopicPag(payload.pag)(state, payload.path);
    }
    case "incrementTopicPagination": {
      return incrementTopicPag(state, payload);
    }
    case "resetSubtopicPagination": {
      return resetSubtopicPag(state, payload);
    }
    case "incrementSubtopicPagination": {
      return incrementSubtopicPag(state, payload);
    }
    case "setSubtopicPagination": {
      return setSubtopicPag(payload.pag)(state, payload.path);
    }
    case "maxSetSubTopicPagination": {
      return maxSetSubtopicPag(state, payload);
    }
    case "mapActions": {
      return pipe(state, payload, Array.reduce(state, actionStreamReducer));
    }
  }
}

const nodePaginationSetter =
  (defaultSize: number) =>
  (pag: number) =>
  <T extends TopicNode | SubtopicNode>(node: T) => {
    // Should never go below default size unless its children length is smaller
    const lowerbound = Math.min(defaultSize, node.children.length - 1);
    return {
      ...node,
      // Should never bo below lower bound or above children length
      pagination: Math.min(Math.max(pag, lowerbound), node.children.length),
    };
  };

const topicNodePagSetter = nodePaginationSetter(defaultTopicPagination);
const subtopicNodePagSetter = nodePaginationSetter(defaultSubtopicPagination);

//  ********************************
//  * ACTION STREAM STATE TRANSFORMERS *
//  *
//  * Functions used directly by the action stream reducer.
//  *
//  * f: Reportstate -> Reportstate
//  ********************************/

const modifyTopic =
  (f: (node: TopicNode) => TopicNode) =>
  (state: ReportState, path: TopicPath): ReportState =>
    pipe(state.children, Array.modify(path.topicIdx, f), (children) => ({
      ...state,
      children,
    }));

const modifySubtopic =
  (f: (node: SubtopicNode) => SubtopicNode) =>
  (state: ReportState, path: SubtopicPath): ReportState =>
    modifyTopic((topicNode) => ({
      ...topicNode,
      children: Array.modify(topicNode.children, path.subtopicIdx, f),
    }))(state, path);

const openTopic = modifyTopic((node) => ({ ...node, isOpen: true }));

const closeTopic = modifyTopic((node) => ({ ...node, isOpen: false }));

const resetTopicPag = modifyTopic(topicNodePagSetter(defaultTopicPagination));

const maxSetTopicPag = modifyTopic((node) => ({
  ...node,
  pagination: node.children.length - 1,
}));

const incrementTopicPag = modifyTopic((node) =>
  topicNodePagSetter(node.pagination + defaultAddTopicPagination)(node),
);

const setTopicPag = (pag: number) => modifyTopic(topicNodePagSetter(pag));

const resetSubtopicPag = modifySubtopic(
  subtopicNodePagSetter(defaultSubtopicPagination),
);

const maxSetSubtopicPag = modifySubtopic((node) => ({
  ...node,
  pagination: node.children.length - 1,
}));

const setSubtopicPag = (pag: number) =>
  modifySubtopic(subtopicNodePagSetter(pag));

const incrementSubtopicPag = modifySubtopic((node) =>
  subtopicNodePagSetter(node.pagination + defaultAddSubtopicPagination)(node),
);

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

const openAllActionStream: MapActions[] = [
  // Open topics
  mapActionToAllTopics(openTopicAction),
  // Set topic pagination to max
  mapActionToAllTopics(maxSetTopicPagAction),
  // Set subtopic pagination to max
  mapActionToAllSubtopics(maxSetSubtopicPagAction),
];

const closeAllActionStream: MapActions[] = [
  // close topics
  mapActionToAllTopics(closeTopicAction),
  // reset topic pagination
  mapActionToAllTopics(resetTopicPagAction),
  // reset subtopic pagination
  mapActionToAllSubtopics(resetSubtopicPagAction),
];

const createIncrementActionStream = Match.type<
  TaggedTopicPath | TaggedSubtopicPath
>().pipe(
  Match.discriminators("type")({
    topic: (path) => [incrementTopicPagAction(path)],
    subtopic: (path) => [incrementSubtopicPagination(path)],
  }),
  Match.exhaustive,
);

export type ReportStateAction = {
  type: ReportStateActionTypes;
  payload: ReportStatePayload;
};

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
});

const makeTopicNode = (topic: schema.Topic): TopicNode => ({
  _tag: "TopicNode",
  id: topic.id,
  data: topic,
  isOpen: false,
  pagination: Math.min(topic.subtopics.length, defaultTopicPagination),
  children: topic.subtopics
    .map(makeSubSubtopicNode)
    .sort((a, b) => getNPeople([b.data]) - getNPeople([a.data])),
});

const makeSubSubtopicNode = (subtopic: schema.Subtopic): SubtopicNode => ({
  _tag: "SubtopicNode",
  id: subtopic.id,
  data: subtopic,
  pagination: Math.min(subtopic.claims.length, defaultSubtopicPagination),
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

const onlyTopicPath = Match.type<
  TaggedTopicPath | TaggedSubtopicPath | ClaimPath
>().pipe(
  Match.when({ type: "topic" }, (action) => Either.right(action)),
  Match.orElse((path) => Either.left(`Invalid path ${path}`)),
);

type ReportStateActionTypes =
  | "open"
  | "close"
  | "openAll"
  | "closeAll"
  | "toggleTopic"
  | "expandTopic"
  | "expandSubtopic"
  | "focus";

type ReportStatePayload = { id: string };

function createPathMapReducer(
  idMap: Record<string, TopicPath | SubtopicPath | ClaimPath>,
) {
  return function (state: ReportState, action: ReportStateAction): ReportState {
    const { id } = action.payload;
    switch (action.type) {
      // For open, we want the same function to work for topics or subtopics.
      // If subtopic, should open parent and set pagination to the correct value
      case "open": {
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
            console.error("Issue with opening");
            return state;
          }),
        );
      }
      case "close": {
        return pipe(
          // string: Path
          idMap,
          // Option Path
          Record.get(id),
          // Either Path
          Either.fromOption(() => "Could not find path"),
          Either.flatMap(onlyTopicPath),
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
            console.error(e);
            return state;
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
        return pipe(
          idMap,
          Record.get(id),
          Either.fromOption(() => "Could not find path"),
          Either.map(
            flow(
              createIncrementActionStream,
              Array.reduce(state, actionStreamReducer),
            ),
          ),
          Either.getOrElse((e) => {
            console.error(e);
            return state;
          }),
        );
      }
      // closes topic and resets its children
      // case "close": {
      //   return combineActions(
      //     closeTopic,
      //     resetTopic,
      //     resetTopicsChildren,
      //   )(state, id);
      // }
      // turns a topic off and on
      // case "toggleTopic": {
      //   return combineActions(toggleTopic, resetTopic)(state, id);
      // }
      // Opens every topic expands its and every child's pagination
      // case "openAll": {
      //   return openAllTopics(state);
      // }
      // Inverse operation of the above
      // case "closeAll": {
      //   return pipe(state, closeAllTopics, resetAllTopics, resetAllSubtopics);
      // }
      // TODO
      // case "expandTopic": {
      //   return expandTopic(state, id);
      // }
      // TODO
      // case "expandSubtopic": {
      //   return expandSubtopic(state, id);
      // }
      // Sets focus id
      // case "focus": {
      //   return setFocusedId(state, id);
      // }
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
