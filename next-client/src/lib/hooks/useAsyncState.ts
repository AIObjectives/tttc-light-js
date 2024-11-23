"use client";

/**
 * useAsyncState
 * Makes handling async call easier.
 */

import { useEffect, useReducer, useState } from "react";
import { z, SafeParseReturnType } from "zod";

/**
 * Data is wrapped in a tuple since we don't know if the Promise will resolve or reject.
 */
export type AsyncData<T> = ["data", T];

/**
 * Data is wrapped in a tuple since we don't know if the Promise will resolve or reject.
 */
export type AsyncError<E> = ["error", E];

/**
 * Default state. Async function has not been called.
 */
export type NotStarted = { isLoading: false; result: undefined };

/**
 * Async function called - Promise has not resolved or rejected
 */
export type IsLoading<T, E> = {
  isLoading: true;
  result: AsyncData<T> | AsyncError<E> | undefined;
};

/**
 * Async function finished - Promise has resolved or rejected.
 */
export type FinishedLoading<T, E> = {
  isLoading: false;
  result: AsyncData<T> | AsyncError<E>;
};

/**
 * Hook for handling the async status of some call. Makes it so its easier to handle loading states.
 * ! I don't like how this handles determining data or error. See if there's a better way.
 */
// export function useAsyncState<T, E, Parser extends z.ZodTypeAny>(
//   func: (arg:T) => Promise<T|E>,
//   dep: T | undefined,
//   parser: Parser,
// ): NotStarted | IsLoading | FinishedLoading<T, E> {
//   /**
//    * Loading state
//    */
//   const [isLoading, setIsLoading] = useState<boolean>(false);

//   /**
//    * Data state. Includes undefined for if the async call has not been triggered
//    * E.g. A file has not been uploaded yet, but we want to handle async when it does.
//    */
//   const [data, setData] = useState<AsyncData<T> | AsyncError<E> | undefined>(
//     undefined,
//   );

//   /**
//    * When the dependencies change, rerun the async function
//    */
//   useEffect(() => {
//     if (dep === undefined) return;
//     // Set loading to true
//     setIsLoading(true);
//     // Do async call
//     (async () => {
//       const newData = await func(dep)
//       // set data
//       setData(() => {
//         const parsed = parser.safeParse(newData)
//         if (parsed.success) return ['data', parsed.data] as AsyncData<T>
//         else return ['error', (newData as E)] as AsyncError<E>
//       });
//       // set loading to false
//     })().then(() => setIsLoading(false));
//   }, [dep]);

//   if (!isLoading)
//     return { isLoading: true, result: undefined };
//   else return { isLoading, result: data };
// }

type LoadingAction<T, E> = { type: "loading" };
type FinishedAction<T, E> = {
  type: "finished";
  payload: AsyncData<T> | AsyncError<E>;
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

export function useAsyncState<T, E>(
  func: (arg: unknown) => Promise<AsyncData<T> | AsyncError<E>>,
  dep: unknown,
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
  }, [dep]);

  return state;
}
