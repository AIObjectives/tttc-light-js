import { ReportState } from "@/components/report/hooks/useReportState";
import { OutlineState } from "./types";
import { createReducer, OutlineStateAction } from "./reducer";
import { Dispatch, useReducer } from "react";
import { createInitialState } from "./utils";
import { mapIdsToPath } from "./path";

export function useOutlineState(
  reportState: ReportState,
): [OutlineState, Dispatch<OutlineStateAction>] {
  const initialState: OutlineState = createInitialState(reportState);
  const idMap = mapIdsToPath(reportState);
  const reducer = createReducer(idMap);
  const [state, dispatch] = useReducer(reducer, initialState);
  return [state, dispatch];
}

export const __internals = {
  createInitialState,
  mapIdsToPath,
  createReducer,
};
