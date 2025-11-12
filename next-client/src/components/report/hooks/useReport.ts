import { useEffect, useState } from "react";
import * as schema from "tttc-common/schema";

import { useReportState, ReportStateAction } from "./useReportState";
import useScrollListener from "./useScrollListener";
import useReportSubscribe from "./useReportSubscribe";
import { useFocusedNode as _useFocusedNode } from "./useFocusedNode";
import { useNavbarVisibility } from "./useNavbarVisibility";
import { useHashChange } from "@/lib/hooks/useHashChange";
import {
  OutlineStateAction,
  useOutlineState,
} from "../../outline/hooks/useOutlineState";

export function useReport(reportData: schema.UIReportData) {
  // Report State reducer
  const [state, _dispatch] = useReportState(reportData.topics);
  // url hash
  const hashNav = useHashChange();
  // Sets up useReportEffect, which can trigger side-effects when Report State dispatch is called.
  const [dispatch, useReportEffect] = useReportSubscribe(_dispatch);
  // Hook that sets up scrolling behavior.
  const [useScrollTo, setScrollTo] = useScrollListener(useReportEffect);
  // Allows us to keep track of what node is in the middle of the screen. Needs to pass hook to nodes.
  const useFocusedNode = _useFocusedNode((id: string) =>
    dispatch({ type: "focus", payload: { id } }),
  );
  // Track navbar visibility for sheet positioning
  const navbarState = useNavbarVisibility();
  useEffect(() => {
    if (!hashNav) return;
    const nodes = [
      ...state.children.map((topic) => topic),
      ...state.children.flatMap((topic) => topic.children.map((sub) => sub)),
      ...state.children.flatMap((topic) =>
        topic.children.flatMap((sub) => sub.children.map((clm) => clm)),
      ),
    ];
    const matchingNode = nodes.find((node) => node.data.title === hashNav);
    if (!matchingNode) return;
    dispatch({ type: "open", payload: { id: matchingNode.data.id } });
  }, [hashNav]);

  const [isMobileOutlineOpen, setIsMobileOutlineOpen] =
    useState<boolean>(false);

  const [outlineState, outlineDispatch] = useOutlineState(state);

  // When Report State dispatch is called, outline state should dispatch some action
  useReportEffect((action) => {
    const matchAction = (
      action: ReportStateAction,
    ): OutlineStateAction | null => {
      switch (action.type) {
        case "open":
        case "close": {
          return {
            type: action.type,
            payload: action.payload,
          };
        }
        case "toggleTopic": {
          return {
            type: "toggle",
            payload: action.payload,
          };
        }
        case "closeAll":
        case "openAll": {
          return {
            type: action.type,
          };
        }
        case "focus": {
          return {
            type: "highlight",
            payload: action.payload,
          };
        }
        default: {
          return null;
        }
      }
    };
    const outlineAction = matchAction(action);
    if (!outlineAction) return;
    outlineDispatch(outlineAction);
  });

  return {
    state,
    dispatch,
    useScrollTo,
    navbarState,
    isMobileOutlineOpen,
    setIsMobileOutlineOpen,
    outlineState,
    outlineDispatch,
    useFocusedNode,
    setScrollTo,
    useReportEffect,
  };
}
