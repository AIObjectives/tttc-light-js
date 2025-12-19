import { Array as Arr, pipe } from "effect";
import type { ActionStreamActions } from "./actions";
import type { OutlineState } from "./types";
/**
 * Intermediate reducer to handle main actions more atomically
 */
export const actionStreamReducer = (
  state: OutlineState,
  action: ActionStreamActions,
): OutlineState => {
  switch (action.type) {
    case "openTopic": {
      return pipe(
        state.tree,
        Arr.modify(action.payload.topicIdx, (node) => ({
          ...node,
          isOpen: true,
        })),
        (tree) => ({ ...state, tree }),
      );
    }

    case "closeTopic": {
      return pipe(
        state.tree,
        Arr.modify(action.payload.topicIdx, (node) => ({
          ...node,
          isOpen: false,
        })),
        (tree) => ({ ...state, tree }),
      );
    }

    case "toggleTopic": {
      return pipe(
        state.tree,
        Arr.modify(action.payload.topicIdx, (node) => ({
          ...node,
          isOpen: !node.isOpen,
        })),
        (tree) => ({ ...state, tree }),
      );
    }

    case "highlightTopic": {
      // When changing the highlighting state, we want to update the cached path
      return pipe(
        state.tree,
        Arr.modify(action.payload.topicIdx, (node) => ({
          ...node,
          isHighlighted: true,
        })),
        (tree) => ({ ...state, tree }),
      );
    }

    case "unhighlightTopic": {
      // When changing the highlighting state, we want to update the cached path
      return pipe(
        state.tree,
        Arr.modify(action.payload.topicIdx, (node) => ({
          ...node,
          isHighlighted: false,
        })),
        (tree) => ({ ...state, tree }),
      );
    }

    case "highlightSubtopic": {
      // When changing the highlighting state, we want to update the cached path
      return pipe(
        state.tree,
        Arr.modify(action.payload.topicIdx, (topic) => ({
          ...topic,
          children: Arr.modify(
            topic.children,
            action.payload.subtopicIdx,
            (subtopic) => ({ ...subtopic, isHighlighted: true }),
          ),
        })),
        (tree) => ({ ...state, tree }),
      );
    }

    case "unhighlightSubtopic": {
      // When changing the highlighting state, we want to update the cached path
      return pipe(
        state.tree,
        Arr.modify(action.payload.topicIdx, (topic) => ({
          ...topic,
          children: Arr.modify(
            topic.children,
            action.payload.subtopicIdx,
            (subtopic) => ({ ...subtopic, isHighlighted: false }),
          ),
        })),
        (tree) => ({ ...state, tree }),
      );
    }

    case "setCachedHighlightPath": {
      return {
        ...state,
        cache: {
          ...state.cache,
          highlightedPath: action.payload,
        },
      };
    }

    case "clearCachedHighlightPath": {
      return {
        ...state,
        cache: {
          ...state.cache,
          highlightedPath: null,
        },
      };
    }
  }
};
