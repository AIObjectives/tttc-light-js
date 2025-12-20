import { type Dispatch, useReducer } from "react";
import type { ReportState } from "@/components/report/hooks/useReportState";
import { mapIdsToPath } from "./path";
import { createReducer, type OutlineStateAction } from "./reducer";
import type { OutlineState } from "./types";
import { createInitialState } from "./utils";

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
