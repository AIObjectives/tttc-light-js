import { Array as Arr, pipe } from "effect";
import type { ActionStreamActions, MapActions } from "./actions";
import {
  defaultAddSubtopicPagination,
  defaultAddTopicPagination,
  defaultSubtopicPagination,
  defaultTopicPagination,
} from "./consts";
import type { SubtopicPath, TopicPath } from "./path";
import type { ReportState, SubtopicNode, TopicNode } from "./types";

//  ********************************
//  * ACTION STREAM REDUCER *
//  *
//  * We want to break down actions from the report state reducer into a series of smaller
//  * more maintainable actions.
//  ********************************/

export function actionStreamReducer(
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
        Arr.reduce(state, actionStreamReducer),
      );
    }
  }
}

//  ********************************
//  * ACTION STREAM HELPER FUNCTIONS *
//  ********************************/

/**
 * Guards against setting a node's pagination above its children length or below its default pag
 * Used for reset and increment operations where we want to maintain minimum defaults
 */
const nodePaginationSetter =
  (defaultSize: number) =>
  (pag: number) =>
  <T extends TopicNode | SubtopicNode>(node: T) => {
    // Should never go below default size unless its children length is smaller
    const lowerbound = Math.min(defaultSize, node.children.length - 1);
    return {
      ...node,
      // Should never go below lower bound or above max children index
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
    pipe(state.children, Arr.modify(path.topicIdx, f), (children) => ({
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
      children: Arr.modify(topicNode.children, path.subtopicIdx, f),
    }))(state, path);
