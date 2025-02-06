"use client";

import { Dispatch, useReducer } from "react";
import { getNPeople } from "tttc-common/morphisms";

import * as schema from "tttc-common/schema";

import {
  Option,
  pipe,
  Array,
  Either,
  Effect,
  Queue,
  flow,
  Match,
  Record,
  Function,
} from "effect";

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
const addTopicPagination = 1;

const defaultSubtopicPagination = 3;
const addSubtopicPagination = 3;

//  ********************************
//  * TYPE DEFINITIONS
//  ********************************/

/**
 * A single Node in the NodeTree. Wraps data.
 */
export type Node<T> = {
  id: string;
  data: Readonly<T>;
};

/**
 * Report State - highest level implementation
 */
export type ReportState = {
  children: TopicNode[];
  focusedId: string | null;
};

/**
 * Nodes with Topics as data
 */
export type TopicNode = Node<schema.Topic> & {
  children: SubtopicNode[];
  isOpen: boolean;
  pagination: number;
};

/**
 * Nodes with Subtopic as data
 */
export type SubtopicNode = Node<schema.Subtopic> & {
  children: ClaimNode[];
  pagination: number;
};

/**
 * Nodes with Claims as data
 */
export type ClaimNode = Node<schema.Claim>;

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

type TopicPath = { type: "topic"; path: { topicIdx: number } };

type SubtopicPath = {
  type: "subtopic";
  path: { topicIdx: number; subtopicIdx: number };
};

type ClaimPath = {
  type: "claim";
  path: { topicIdx: number; subtopicIdx: number; claimIdx: number };
};

/**
 * Takes the state and maps every id to a Path
 *
 * Returns a Record id -> (TopicPath | SubtopicPath | ClaimPath)
 */
const mapIdsToPath = (
  state: ReportState,
): Record<string, TopicPath | SubtopicPath | ClaimPath> =>
  pipe(
    state.children,
    // Create entries for top-level topics
    Array.reduce(
      {} as Record<string, TopicPath | SubtopicPath>,
      (idxMap, current, i) =>
        pipe(
          idxMap,
          // Add entry for current topic
          Record.set(current.id, {
            type: "topic",
            path: { topicIdx: i },
          } as TopicPath),
          // Add entries for all subtopics
          (idxMap) =>
            pipe(
              current.children,
              Array.reduce(idxMap, (subtopicAccum, subtopic, j) =>
                pipe(
                  subtopicAccum,
                  Record.set(subtopic.id, {
                    type: "subtopic",
                    path: { topicIdx: i, subtopicIdx: j },
                  } as SubtopicPath),
                  // add entries for all claims
                  (idxMap) =>
                    pipe(
                      subtopic.children,
                      Array.reduce(idxMap, (claimAccum, claim, k) =>
                        pipe(
                          claimAccum,
                          Record.set(claim.id, {
                            type: "claim",
                            path: { topicIdx: i, subtopicIdx: j, claimIdx: k },
                          } as ClaimPath),
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
  payload: { path: { topicIdx: number } };
};

type SetTopicPaginationAction = {
  type: "setTopicPagination";
  payload: { path: { topicIdx: number }; pag: number };
};

type SetSubtopicPaginationAction = {
  type: "setSubtopicPagination";
  payload: { path: { topicIdx: number; subtopicIdx: number }; pag: number };
};

type TopicActions = OpenTopicAction | SetTopicPaginationAction;

type SubtopicActions = SetSubtopicPaginationAction;

function actionStreamReducer(
  state: ReportState,
  action: TopicActions | SubtopicActions,
): ReportState {
  switch (action.type) {
    case "openTopic": {
      return setTopicToOpen(state, action);
    }
    case "setTopicPagination": {
      return setTopicPagination(state, action);
    }
    case "setSubtopicPagination": {
      return setSubtopicPagination(state, action);
    }
  }
}

//  ********************************
//  * ACTION STREAM ACTIONS *
//  *
//  * Action builders for the action stream reducer.
//  ********************************/

const openTopicAction = (path: { topicIdx: number }): OpenTopicAction => ({
  type: "openTopic",
  payload: { path },
});

const setTopicPaginationAction = (path: {
  topicIdx: number;
  subtopicIdx: number;
}): SetTopicPaginationAction => ({
  type: "setTopicPagination",
  payload: { path, pag: Math.max(path.subtopicIdx, defaultTopicPagination) },
});

const setSubtopicPaginationAction = (
  path: { topicIdx: number; subtopicIdx: number; claimIdx: number },
  pag: number,
): SetSubtopicPaginationAction => ({
  type: "setSubtopicPagination",
  payload: { path, pag },
});

//  ********************************
//  * NODE TRANSFORMERS *
//  *
//  * Functions for modify an individual node
//  ********************************/

const setNodeOpen = (node: TopicNode): TopicNode => ({
  ...node,
  isOpen: true,
});

const setNodePagination =
  (pag: number) =>
  <T extends TopicNode | SubtopicNode>(node: T): T => ({
    ...node,
    pagination: pag,
  });

//  ********************************
//  * ACTION STREAM STATE TRANSFORMERS *
//  *
//  * Functions used directly by the action stream reducer.
//  ********************************/

/**
 * Helper function for changing a node in an array of topics
 */
const modifyTopic =
  (index: number, f: (node: TopicNode) => TopicNode) => (topics: TopicNode[]) =>
    Array.modify(topics, index, f);

/**
 * Helper function for changin a subtopic, starting from an array of topics
 */
const modifySubtopic = (
  path: { topicIdx: number; subtopicIdx: number },
  f: (node: SubtopicNode) => SubtopicNode,
) =>
  modifyTopic(path.topicIdx, (topicNode) => ({
    ...topicNode,
    children: Array.modify(topicNode.children, path.subtopicIdx, f),
  }));

/**
 * Takes an OpenTopicAction, changes a topic to open, and returns a new report state
 */
const setTopicToOpen = (
  state: ReportState,
  { payload }: OpenTopicAction,
): ReportState =>
  pipe(
    state.children,
    modifyTopic(payload.path.topicIdx, setNodeOpen),
    (children) => ({
      ...state,
      children,
    }),
  );

/**
 * Takes a SetTopicPaginationAction, changes a topic's pagination, and returns a new report state
 */
const setTopicPagination = (
  state: ReportState,
  { payload }: SetTopicPaginationAction,
): ReportState =>
  pipe(
    state.children,
    Array.modify(payload.path.topicIdx, setNodePagination(payload.pag)),
    (children) => ({ ...state, children }),
  );

/**
 * Takes a SetSubtopicPaginationAction, changes a subtopic's pagination, and returns a new state
 */
const setSubtopicPagination = (
  state: ReportState,
  { payload }: SetSubtopicPaginationAction,
) =>
  pipe(
    state.children,
    modifySubtopic(payload.path, setNodePagination(payload.pag)),
    (children) => ({ ...state, children }),
  );

//  ********************************
//  * REPORTSTATE ACTIONS ->  ACTION STREAM ACTIONS *
//  *
//  * Translates a report state action into a series of action stream reducer actions.
//  * These should each handle every possible case.
//  ********************************/

/**
 * Action stream actions for "Open"
 */
const createOpenActionStream = Match.type<
  TopicPath | SubtopicPath | ClaimPath
>().pipe(
  /**
   * When the node is a topic node, just open it
   */
  Match.when({ type: "topic" }, ({ path }): TopicActions[] => [
    openTopicAction(path),
  ]),
  /**
   * When the node is a subtopic node:
   * - open the parent topic node
   * - set the topic pagination so the subtopic is visible
   */
  Match.when({ type: "subtopic" }, ({ path }): TopicActions[] => [
    openTopicAction(path),
    setTopicPaginationAction(path),
  ]),
  /**
   * When the node is a claim node:
   * - Open the parent topic
   * - Set the parent topic's pagination so the parent subtopic is is visible
   * - Set the parent subtopic's pagination is the claim is visible.
   */
  Match.when(
    { type: "claim" },
    ({ path }): (TopicActions | SubtopicActions)[] => [
      openTopicAction(path),
      setTopicPaginationAction({ ...path }),
      setSubtopicPaginationAction(path, path.claimIdx),
    ],
  ),
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
  id: topic.id,
  data: topic,
  isOpen: false,
  pagination: Math.min(topic.subtopics.length, defaultTopicPagination),
  children: topic.subtopics
    .map(makeSubSubtopicNode)
    .sort((a, b) => getNPeople([b.data]) - getNPeople([a.data])),
});

const makeSubSubtopicNode = (subtopic: schema.Subtopic): SubtopicNode => ({
  id: subtopic.id,
  data: subtopic,
  pagination: Math.min(subtopic.claims.length, defaultSubtopicPagination),
  children: subtopic.claims.map(makeClaimNode),
});

const makeClaimNode = (claim: schema.Claim): ClaimNode => ({
  id: claim.id,
  data: claim,
});

//  ********************************
//  * REPORT STATE REDUCER *
//  ********************************/

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
          idMap,
          Record.get(id),
          Option.map(
            flow(
              // Break down the action into a bunch of subactions
              createOpenActionStream,
              // and reduce over the state
              Array.reduce(state, actionStreamReducer),
            ),
          ),
          // If idxMap for some reason couldn't find the Path, just return the state.
          // TODO: Include more comprehensive error handling.
          Option.getOrElse(() => state),
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
  stateBuilder,
};

export default useReportState;
