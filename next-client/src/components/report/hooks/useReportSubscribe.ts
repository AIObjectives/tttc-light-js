"use client";

import { type Dispatch, useEffect, useState } from "react";
import type { ReportStateAction } from "./useReportState";

type ReportActionEffectFunc = (action: ReportStateAction) => void;
type ReportActionEffect = (func: ReportActionEffectFunc) => void;

/**
 * Keeps track of Report State dispatches.
 * Returns a new dispatch function and a useReportEffect hook that runs when a new dispatch happens.
 */
function useReportSubscribe(
  dispatch: Dispatch<ReportStateAction>,
): [Dispatch<ReportStateAction>, ReportActionEffect] {
  // Tracks dispatches and when they were called.
  const [actionState, setActionState] = useState<
    [ReportStateAction | null, number]
  >([null, Date.now()]);

  // Wraps original dispatch function
  const newDispatch = (action: ReportStateAction) => {
    setActionState([action, Date.now()]);
    return dispatch(action);
  };

  // Triggers some side-effect when dispatch is called
  const useReportEffect = (func: (action: ReportStateAction) => void) => {
    // biome-ignore lint/correctness/useExhaustiveDependencies: func is intentionally excluded - we want this effect to run only when actionState changes (when a dispatch happens), not on every render when func is recreated
    useEffect(() => {
      if (!actionState[0]) return;
      func(actionState[0]);
    }, [actionState]);
  };

  return [newDispatch, useReportEffect];
}

export default useReportSubscribe;
