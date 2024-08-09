"use client";

import { Dispatch, useEffect, useState } from "react";
import { ReportStateAction } from "./useReportState";

type ReportActionEffectFunc = (action: ReportStateAction) => void;
type ReportActionEffect = (func: ReportActionEffectFunc) => void;

function useReportSubscribe(
  dispatch: Dispatch<ReportStateAction>,
): [Dispatch<ReportStateAction>, ReportActionEffect] {
  const [actionState, setActionState] = useState<
    [ReportStateAction | null, number]
  >([null, Date.now()]);

  const newDispatch = (action: ReportStateAction) => {
    setActionState([action, Date.now()]);
    return dispatch(action);
  };

  const useReportEffect = (func: (action: ReportStateAction) => void) => {
    useEffect(() => {
      if (!actionState[0]) return;
      func(actionState[0]);
    }, [actionState]);
  };

  return [newDispatch, useReportEffect];
}

export default useReportSubscribe;
