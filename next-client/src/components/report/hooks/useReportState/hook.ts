"use client";

import { type Dispatch, useReducer } from "react";
import type * as schema from "tttc-common/schema";
import { mapIdsToPath } from "./path";
import { createPathMapReducer, type ReportStateAction } from "./reducer";
import type { ReportState } from "./types";
import { stateBuilder } from "./utils";

/**
 * Hook for managing the state of the report
 *
 * Should only be invoked once for a report
 */
export function useReportState(
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
