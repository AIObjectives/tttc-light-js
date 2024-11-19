"use client";

/**
 * useCostEstimate
 * This approach estimates the cost of running a TTTC report by the number of characters in the csv data.
 * There are two ways of doing this defined below. One is commented out. Either we can parse the file and measure the string size with the first function, or measure the file size directly with the second.
 * TODO: Determine which function to use. Will probably change in the future depending on new media types.
 */

import * as schema from "tttc-common/schema";
import { useParseCsv } from "./useParseCSV";
// import { useReactiveValue } from "@src/lib/hooks/useReactiveValue";

/**
 * Number of char chracters in a 1mb string
 */
const oneMbCharSize = 1048576;

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
const costPerMb = (charCount: number) => (charCount / oneMbCharSize) * 24;

/**
 * Hook for getting the cost estimate.
 * Returns a string of either the amount, "loading" if Promise not resolved, "-.--" if no file is uploaded, or "error" if error during parsing.
 */
export function useCostEstimate(files: FileList | undefined) {
  const { isLoading, result } = useParseCsv(files);

  if (isLoading) return "Loading...";
  else if (result === undefined) return "$-.--";
  else if (result[0] === "error") return "Error...";

  return `$${costPerMb(getCharLength(result[1] as schema.SourceRow[])).toFixed(2)}`;
}

// const bytesToMb = (bytes:number) => bytes * 1024 * 1024;

// const fileToCost = (file:File|undefined) => file === undefined ? "-.--" : `$${(bytesToMb(file.size) * 24).toFixed(2)}`

// export function useCostEstimate(files: FileList | undefined) {
//   const maybeFile = files?.item(0) || undefined
//   const cost = useReactiveValue(()=> fileToCost(maybeFile), [maybeFile, maybeFile?.name, maybeFile?.lastModified])
//   return cost
// }
