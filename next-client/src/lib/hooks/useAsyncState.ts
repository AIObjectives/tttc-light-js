"use client";

/**
 * useAsyncState
 * Makes handling async call easier.
 */

import { useEffect, useState } from "react";
import { z } from "zod";

/**
 * Data is wrapped in a tuple since we don't know if the Promise will resolve or reject.
 */
export type AsyncData<T> = ["data", T];

/**
 * Data is wrapped in a tuple since we don't know if the Promise will resolve or reject.
 */
export type AsyncError<E> = ["error", E];

/**
 * Promise has resolved or rejected.
 */
type FinishedLoading<T, E> = {
  isLoading: false;
  result: AsyncData<T> | AsyncError<E>;
};

/**
 * Promise has not resolved or rejected
 */
type IsLoading = { isLoading: true; result: undefined };

/**
 * Takes a function and wraps it in a tuple with data or error.
 * ! Look back over this and find a better way of doing this.
 */
const asyncStateWrapping = async <T, E, Parser extends z.ZodTypeAny>(
  cb: () => Promise<T | E>,
  dataParser: Parser,
): Promise<AsyncData<T> | AsyncError<E>> =>
  cb().then((maybe) =>
    dataParser.safeParse(maybe).success
      ? (["data", maybe] as AsyncData<T>)
      : (["error", maybe] as AsyncError<E>),
  );

/**
 * Hook for handling the async status of some call. Makes it so its easier to handle loading states.
 * ! I don't like how this handles determining data or error. See if there's a better way.
 */
export function useAsyncState<T, E, Parser extends z.ZodTypeAny>(
  func: () => Promise<T | E>,
  deps: unknown[],
  parser: Parser,
): IsLoading | FinishedLoading<T, E> {
  /**
   * Loading state
   */
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   * Data state. Includes undefined for if the async call has not been triggered
   * E.g. A file has not been uploaded yet, but we want to handle async when it does.
   */
  const [data, setData] = useState<AsyncData<T> | AsyncError<E> | undefined>(
    undefined,
  );

  /**
   * When the dependencies change, rerun the async function
   */
  useEffect(() => {
    // Set loading to true
    setIsLoading(true);
    // Do async call
    (async () => {
      const newData = (await asyncStateWrapping(func, parser)) as
        | AsyncData<T>
        | AsyncError<E>;
      // set data
      setData(() => newData);
      // set loading to false
    })().then(() => setIsLoading(false));
  }, [...deps]);

  if (isLoading || data === undefined)
    return { isLoading: true, result: undefined };
  else return { isLoading, result: data };
}
