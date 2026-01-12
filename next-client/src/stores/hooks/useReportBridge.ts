"use client";

import { useCallback } from "react";
import { useReportStore } from "../reportStore";
import { useReportUIStore } from "../reportUIStore";

/**
 * Bridge hook that provides backward-compatible dispatch function.
 * Maps old ReportStateAction to new store actions.
 *
 * This allows gradual migration from the old reducer-based dispatch
 * to direct store action calls.
 *
 * @example
 * // Old pattern (still works with this bridge)
 * dispatch({ type: "toggleTopic", payload: { id: topicId } });
 *
 * // New pattern (preferred after migration)
 * const toggleTopic = useReportStore((s) => s.toggleTopic);
 * toggleTopic(topicId);
 */
export function useReportDispatch() {
  const openNode = useReportStore((s) => s.openNode);
  const closeNode = useReportStore((s) => s.closeNode);
  const toggleTopic = useReportStore((s) => s.toggleTopic);
  const openAllTopics = useReportStore((s) => s.openAllTopics);
  const closeAllTopics = useReportStore((s) => s.closeAllTopics);
  const expandPagination = useReportStore((s) => s.expandPagination);
  const setFocusedNodeId = useReportUIStore((s) => s.setFocusedNodeId);

  const dispatch = useCallback(
    (action: { type: string; payload?: { id: string } }) => {
      switch (action.type) {
        case "open":
          if (action.payload?.id) openNode(action.payload.id);
          break;
        case "close":
          if (action.payload?.id) closeNode(action.payload.id);
          break;
        case "toggleTopic":
          if (action.payload?.id) toggleTopic(action.payload.id);
          break;
        case "openAll":
          openAllTopics();
          break;
        case "closeAll":
          closeAllTopics();
          break;
        case "expandTopic":
        case "expandSubtopic":
          if (action.payload?.id) expandPagination(action.payload.id);
          break;
        case "focus":
          if (action.payload?.id) setFocusedNodeId(action.payload.id);
          break;
        default:
          console.warn(
            `[useReportDispatch] Unknown action type: ${action.type}`,
          );
      }
    },
    [
      openNode,
      closeNode,
      toggleTopic,
      openAllTopics,
      closeAllTopics,
      expandPagination,
      setFocusedNodeId,
    ],
  );

  return dispatch;
}
