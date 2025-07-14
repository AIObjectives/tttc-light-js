import {
  createOpenActionStream,
  createCloseActionStream,
  createHighlightedActionStream,
  createToggleActionStream,
  createUnhighlightedActionStream,
} from "./actionStream";
import { actionStreamReducer } from "./actionStreamReducer";
import { TaggedTopicPath, TaggedSubtopicPath, OutlineState } from "./types";
import { pipe, Record, Either, Array, flow, Option } from "effect";

//  ********************************
//  * Reducer *
//  ********************************/

type OutlineStateActionsWithId = {
  type: "open" | "close" | "toggle" | "highlight";
  payload: { id: string };
};

type OutlineStateActionsWithoutId = {
  type: "openAll" | "closeAll";
};

type OutlineStateClearErrorAction = {
  type: "clearError";
};

export type OutlineStateAction =
  | OutlineStateActionsWithId
  | OutlineStateActionsWithoutId
  | OutlineStateClearErrorAction;

export function createReducer(
  idMap: Record<string, TaggedTopicPath | TaggedSubtopicPath>,
) {
  return function (
    state: OutlineState,
    action: OutlineStateAction,
  ): OutlineState {
    switch (action.type) {
      case "open": {
        const { id } = action.payload;
        return pipe(
          idMap,
          // get the path to reach this id
          Record.get(id),
          Either.fromOption(() => "Could not find path for action: " + id),
          Either.map(
            flow(
              // create the set of actions based on the type of path
              createOpenActionStream,
              // reduce the set of actions over the state
              Array.reduce(state, actionStreamReducer),
            ),
          ),
          Either.getOrElse((e) => {
            if (process.env.NODE_ENV === "development") {
              throw new Error(e);
            } else {
              return {
                ...state,
                error: e,
              };
            }
          }),
        );
      }
      case "close": {
        const { id } = action.payload;
        return pipe(
          idMap,
          Record.get(id),
          Option.flatMap((val) =>
            val.type === "subtopic" ? Option.none() : Option.some(val),
          ),
          Either.fromOption(() => "Could not find path for action: " + id),
          Either.map(
            flow(
              createCloseActionStream,
              Array.reduce(state, actionStreamReducer),
            ),
          ),
          Either.getOrElse((e) => {
            if (process.env.NODE_ENV === "development") {
              throw new Error(e);
            } else {
              return {
                ...state,
                error: e,
              };
            }
          }),
        );
      }
      case "toggle": {
        const { id } = action.payload;
        return pipe(
          idMap,
          Record.get(id),
          Option.flatMap((val) =>
            val.type === "subtopic" ? Option.none() : Option.some(val),
          ),
          Either.fromOption(() => "Could not find path for action: " + id),
          Either.map(
            flow(
              createToggleActionStream,
              Array.reduce(state, actionStreamReducer),
            ),
          ),
          Either.getOrElse((e) => {
            if (process.env.NODE_ENV === "development") {
              throw new Error(e);
            } else {
              return {
                ...state,
                error: e,
              };
            }
          }),
        );
      }
      case "highlight": {
        const { id } = action.payload;
        return pipe(
          idMap,
          Record.get(id),
          Either.fromOption(() => "Could not find path for action: " + id),
          Either.map(
            flow(
              /**
               * We handle this case a little differently than the previous actions
               * Use both the highlight and unhighlight action stream creators
               * We want to turn the previously highlighted node off (if applicable) first
               * before turning the next one on.
               */
              (path) =>
                Array.flatten([
                  createUnhighlightedActionStream(state.cache.highlightedPath),
                  createHighlightedActionStream(path),
                ]),
              (arr) => arr,
              Array.reduce(state, actionStreamReducer),
            ),
          ),
          Either.getOrElse((e) => {
            if (process.env.NODE_ENV === "development") {
              throw new Error(e);
            } else {
              return {
                ...state,
                error: e,
              };
            }
          }),
        );
      }
      case "openAll": {
        return pipe(
          state.tree,
          Array.flatMap((_, i) =>
            createOpenActionStream({ type: "topic", topicIdx: i }),
          ),
          Array.reduce(state, actionStreamReducer),
        );
      }
      case "closeAll": {
        return pipe(
          state.tree,
          Array.flatMap((_, i) =>
            createCloseActionStream({ type: "topic", topicIdx: i }),
          ),
          Array.reduce(state, actionStreamReducer),
        );
      }
      case "clearError": {
        return {
          ...state,
          error: null,
        };
      }
      default: {
        return state;
      }
    }
  };
}
