"use client";

/**
 * useAsyncState
 * Makes handling async call easier.
 */

import { useEffect, useReducer } from "react";
import type { Result } from "tttc-common/functional-utils";

/**
 * Default state. Async function has not been called.
 */
export type NotStarted = { isLoading: false; result: undefined };

/**
 * Async function called - Promise has not resolved or rejected
 */
export type IsLoading<T, E> = {
  isLoading: true;
  result: Result<T, E> | undefined;
};

/**
 * Async function finished - Promise has resolved or rejected.
 */
export type FinishedLoading<T, E> = {
  isLoading: false;
  result: Result<T, E>;
};

type LoadingAction<_T, _E> = { type: "loading" };
type FinishedAction<T, E> = {
  type: "finished";
  payload: Result<T, E>;
};

export type AsyncState<T, E> =
  | NotStarted
  | IsLoading<T, E>
  | FinishedLoading<T, E>;

function asyncReducer<T, E>(
  state: AsyncState<T, E>,
  action: LoadingAction<T, E> | FinishedAction<T, E>,
): AsyncState<T, E> {
  switch (action.type) {
    case "loading": {
      return { isLoading: true, result: state.result };
    }
    case "finished": {
      return { isLoading: false, result: action.payload };
    }
    default: {
      return { isLoading: false, result: undefined };
    }
  }
}

export function useAsyncState<T, E, Params>(
  func: (arg: Params) => Promise<Result<T, E>>,
  dep: Params | undefined,
) {
  const [state, dispatch] = useReducer(asyncReducer<T, E>, {
    isLoading: false,
    result: undefined,
  });

  useEffect(() => {
    if (dep === undefined) return;
    dispatch({ type: "loading" });
    (async () => {
      const res = await func(dep);
      dispatch({ type: "finished", payload: res });
    })();
  }, [dep, func]);

  return state;
}
