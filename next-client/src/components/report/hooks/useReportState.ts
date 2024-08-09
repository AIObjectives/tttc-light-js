"use client";

import { Dispatch, useReducer } from "react";

import * as schema from "tttc-common/schema";

const defaultTopicPagination = 1;
const addTopicPagination = 1;

const defaultSubtopicPagination = 1;
const addSubtopicPagination = 1;

//  ********************************
//  * TYPE DEFINITIONS
//  ********************************/

/**
 * All Node.data should have an id for easy lookup
 */
export type HasId = { id: string };

/**
 * A single Node in the NodeTree. Wraps data.
 */
export type Node<T extends HasId> = {
  data: Readonly<T>;
};

/**
 * Report State - highest level implementation
 */
export type ReportState = {
  children: TopicNode[];
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

export type ClaimNode = Node<schema.Claim>;

export type SomeNode = TopicNode | SubtopicNode | ClaimNode;

//  ********************************
//  * UTILITY FUNCTIONS *
//  ********************************/

const identity = <T>(arg: T): T => arg;

const undefinedCheck = <T>(
  arg: T | undefined,
  errorMessage: string = "Falsy check failed",
) => {
  if (arg === undefined) {
    throw new Error(errorMessage);
  }
  return arg;
};

const replaceNode = <T extends SomeNode>(nodes: T[], node: T): T[] => {
  const idx = nodes.findIndex((_node) => _node.data.id === node.data.id);
  if (idx === -1) return nodes;
  return [...nodes.slice(0, idx), node, ...nodes.slice(idx + 1)];
};

//  ********************************
//  * HIGHER ORDER FUNCTIONS *
//  ********************************/

export type TransformationFunction<T> = (arg: T) => T;

type StateActionOnId = (state: ReportState, id: string) => ReportState;

const combineActions =
  (...funcs: StateActionOnId[]) =>
  (state: ReportState, id: string) =>
    funcs.reduce((accum, curr) => {
      return curr(accum, id);
    }, state);

const mapActions =
  (...funcs: TransformationFunction<ReportState>[]) =>
  (state: ReportState): ReportState =>
    funcs.reduce((accum, curr) => curr(accum), state);

//  ********************************
//  * THEME STATE FUNCTIONS *
//  ********************************/

// **** Base Functions ****

const findTopic = (state: ReportState, id: string): TopicNode =>
  undefinedCheck(
    state.children.find((node) => node.data.id === id),
    "Couldn't find topic with provided Id",
  );

// **** Applicative Functions ****

const changeTopic =
  (transform: TransformationFunction<TopicNode>) =>
  (state: ReportState, id: string): ReportState => ({
    ...state,
    children: replaceNode(state.children, transform(findTopic(state, id))),
  });

const mapTopic =
  (transform: TransformationFunction<TopicNode>) =>
  (state: ReportState): ReportState => ({
    ...state,
    children: state.children.map(transform),
  });

// **** Transformers ****

const openTopic = changeTopic((node) => ({ ...node, isOpen: true }));

const closeTopic = changeTopic((node) => ({ ...node, isOpen: false }));

const toggleTopic = changeTopic((node) => ({ ...node, isOpen: !node.isOpen }));

const openAllTopics = mapTopic((node) => ({ ...node, isOpen: true }));

const closeAllTopics = mapTopic((node) => ({ ...node, isOpen: false }));

const resetAllTopics = mapTopic((node) => ({
  ...node,
  pagination: defaultTopicPagination,
}));

const expandTopic = changeTopic((node) => ({
  ...node,
  pagination: node.pagination + addTopicPagination,
}));

const setTopicPagination = (num: number) =>
  changeTopic((node) => ({
    ...node,
    pagination: num,
  }));

const resetTopic = setTopicPagination(defaultTopicPagination);

//  ********************************
//  * SUBTOPIC STATE FUNCTIONS *
//  ********************************/

// **** Base Functions ****

const findSubtopicInTopic = (
  topic: TopicNode,
  id: string,
): SubtopicNode | undefined =>
  topic.children.find((node) => node.data.id === id);

const _findSubtopic = (
  TopicNodes: TopicNode[],
  id: string,
): SubtopicNode | undefined => {
  if (TopicNodes.length === 0) return undefined;
  const res = findSubtopicInTopic(TopicNodes[0], id);
  if (!res) return _findSubtopic(TopicNodes.slice(1), id);
  return res;
};

const findSubtopic = (state: ReportState, id: string): SubtopicNode =>
  undefinedCheck(
    _findSubtopic(state.children, id),
    "Could't find topic with provided Id",
  );

const _parentOfSubtopic = (
  topics: TopicNode[],
  subtopicId: string,
): TopicNode | undefined => {
  if (!topics.length) return undefined;
  else if (
    topics[0].children.some((node: SubtopicNode) => node.data.id === subtopicId)
  )
    return topics[0];
  return _parentOfSubtopic(topics.slice(1), subtopicId);
};

const parentOfSubtopic = (topics: TopicNode[], subtopicId: string) =>
  undefinedCheck(
    _parentOfSubtopic(topics, subtopicId),
    "Could not find parent of subtopic with id provided",
  );

// **** Applicative Functions ****

const changeSubtopic =
  (transform: TransformationFunction<SubtopicNode>) =>
  (state: ReportState, id: string): ReportState => {
    const subtopic = findSubtopic(state, id);
    return {
      ...state,
      children: state.children.map((topic) => ({
        ...topic,
        children: replaceNode(topic.children, transform(subtopic)),
      })),
    };
  };

const mapSubtopic = (transform: TransformationFunction<SubtopicNode>) =>
  mapTopic((topic) => ({
    ...topic,
    children: topic.children.map(transform),
  }));

const mapTopicChildren =
  (transform: TransformationFunction<SubtopicNode>) =>
  (state: ReportState, topicId: string): ReportState =>
    mapTopic((topic) => ({
      ...topic,
      children: topic.children.map(
        topic.data.id === topicId ? transform : identity,
      ),
    }))(state);

// **** Transformers ****

const expandSubtopic = changeSubtopic((node) => ({
  ...node,
  pagination: node.pagination + addSubtopicPagination,
}));

const resetSubtopic = changeSubtopic((node) => ({
  ...node,
  pagination: defaultSubtopicPagination,
}));

const resetTopicsTopics = mapTopicChildren((topic) => ({
  ...topic,
  pagination: defaultSubtopicPagination,
}));

const resetAllSubtopics = mapSubtopic((node) => ({
  ...node,
  pagination: defaultSubtopicPagination,
}));

//  ********************************
//  * STATE BUILDERS *
//  ********************************/

const stateBuilder = (topics: schema.Topic[]): ReportState => ({
  children: topics.map(makeTopicNode),
});

const makeTopicNode = (topic: schema.Topic): TopicNode => ({
  data: topic,
  isOpen: false,
  pagination: defaultTopicPagination,
  children: topic.subtopics.map(makeSubSubtopicNode),
});

const makeSubSubtopicNode = (subtopic: schema.Subtopic): SubtopicNode => ({
  data: subtopic,
  pagination: defaultSubtopicPagination,
  children: subtopic.claims.map(makeClaimNode),
});

const makeClaimNode = (claim: schema.Claim): ClaimNode => ({
  data: claim,
});

//  ********************************
//  * REDUCER *
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

export type ReportStateAction = {
  type: ReportStateActionTypes;
  payload: ReportStatePayload;
};

function reducer(state: ReportState, action: ReportStateAction): ReportState {
  const { id } = action.payload;
  switch (action.type) {
    // For open, we want the same function to work for topics or subtopics.
    // If subtopic, should open parent and set pagination to the correct value
    case "open": {
      const maybeTopicIdx = state.children.findIndex(
        (node) => node.data.id === id,
      );
      if (maybeTopicIdx !== -1) return openTopic(state, id);
      const parentTopic = parentOfSubtopic(state.children, id);
      const topicIdx = parentTopic.children.findIndex(
        (topic) => topic.data.id === id,
      );
      const func = combineActions(
        openTopic,
        setTopicPagination(
          topicIdx + 1 > parentTopic.pagination
            ? topicIdx + 1
            : parentTopic.pagination,
        ),
      );
      return func(state, parentTopic.data.id);
    }
    case "close": {
      return combineActions(
        closeTopic,
        resetTopic,
        resetTopicsTopics,
      )(state, id);
    }
    case "toggleTopic": {
      return combineActions(toggleTopic, resetTopic)(state, id);
    }
    case "openAll": {
      return openAllTopics(state);
    }
    case "closeAll": {
      return mapActions(
        closeAllTopics,
        resetAllTopics,
        resetAllSubtopics,
      )(state);
    }
    case "expandTopic": {
      return expandTopic(state, id);
    }
    case "expandSubtopic": {
      return expandSubtopic(state, id);
    }
    case "focus": {
      // placeholder for now to trigger sideffect
      // TODO: This is a code-smell, figure out what to do.
      return state;
    }
    default: {
      return state;
    }
  }
}

function useReportState(
  topics: schema.Topic[],
): [ReportState, Dispatch<ReportStateAction>] {
  const [state, dispatch] = useReducer(reducer, stateBuilder(topics));
  return [state, dispatch];
}

export const __internals = {
  undefinedCheck,
  combineActions,
  mapActions,
  replaceNode,
  findTopic,
  changeTopic,
  mapTopic,
  openTopic,
  closeTopic,
  toggleTopic,
  openAllTopics,
  closeAllTopics,
  resetTopic,
  resetAllTopics,
  expandTopic,
  findSubtopicInTopic,
  findSubtopic,
  parentOfSubtopic,
  changeSubtopic,
  mapSubtopic,
  expandSubtopic,
  resetSubtopic,
  resetAllSubtopics,
  reducer,
  stateBuilder,
  mapTopicChildren,
  resetTopicsTopics,
  defaultTopicPagination,
  defaultSubtopicPagination,
  addTopicPagination,
  addSubtopicPagination,
};

export default useReportState;
