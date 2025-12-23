"use client";

/**
 * useCostEstimate
 * This approach estimates the cost of running a TTTC report by the number of characters in the csv data.
 * There are two ways of doing this defined below. Either we can parse the file and measure the string size with the first function, or measure the file size directly with the second.
 * TODO: Determine which function to use. Will probably change in the future depending on new media types.
 */

import type * as schema from "tttc-common/schema";
import { useParseCsv } from "./useParseCSV";

// import { useReactiveValue } from "@/lib/hooks/useReactiveValue";

/**
 * Number of characters in a 1mb string
 */
const oneMbCharSize = 1048576;
const costPerMb = 24;

/**
 * Take the source rows and count the number of tokens
 * ! Right now it just includes the comment and id. Figure out if there are any other fields included.
 */
const getCharLength = (sourceRows: schema.SourceRow[]) =>
  sourceRows.reduce((accum, curr) => {
    accum += (curr.comment + curr.id).length;
    return accum;
  }, 0);

/**
 * Cost given number of tokens in 1mb
 */
const calcCost = (charCount: number) => (charCount / oneMbCharSize) * costPerMb;

/**
 * Hook for getting the cost estimate.
 * Returns a string of either the amount, "loading" if Promise not resolved, "-.--" if no file is uploaded, or "error" if error during parsing.
 */
export function useCostEstimate(files: FileList | undefined, maxSize?: number) {
  const { isLoading, result } = useParseCsv(files, maxSize);

  if (isLoading) return "Loading...";
  else if (result === undefined) return "$-.--";
  else if (result.tag === "failure") return "Error...";

  return `$${calcCost(getCharLength(result.value as schema.SourceRow[])).toFixed(2)}`;
}
