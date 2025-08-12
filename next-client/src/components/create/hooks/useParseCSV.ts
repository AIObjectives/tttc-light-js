"use client";

/**
 * useParseCSV
 * We use PapaParse to parse the raw file data into an array of objects, and then Zod to ensure correct type-safety
 * Right now intended only for the CreateReport component during the data upload section. Can be extended to be more generalizable in the future if necessary.
 * There's some somewhat questionable FP standins that would be better if we actually used a full FP library. Go back and redo this in the future if we do.
 */

import { AsyncState, useAsyncState } from "@/lib/hooks/useAsyncState";
import Papa from "papaparse";
import * as schema from "tttc-common/schema";
import { z } from "zod";
import { failure, success, Result } from "tttc-common/functional-utils";

/**
 * Shape of error that can be returned by useParseCSV. Use this to build specific errors
 */
const csvError = <T extends string>(tag: T) =>
  z.object({ tag: z.literal(tag), message: z.string().optional() });

/**
 * Zod error - row does not match intended shape.
 */
const badFormatCsv = csvError("Poorly formatted CSV" as const);

type BadFormatCSV = z.infer<typeof badFormatCsv>;

/**
 * PapaParse threw an error trying to parse the file.
 */
const brokenFile = csvError("Broken file" as const);

type BrokenFileError = z.infer<typeof brokenFile>;

/**
 * ! Temporary for alpha - limit size of file
 */
const sizeError = csvError("Size Error");

type SizeError = z.infer<typeof sizeError>;

/**
 * Union of possible errors
 */
const CsvErrors = z.union([badFormatCsv, brokenFile, sizeError]);

type CSVErrors = z.infer<typeof CsvErrors>;

/**
 * ! Temporary for alpha - limit size of file
 */
const sizeCheck = (buffer: ArrayBuffer): Result<ArrayBuffer, SizeError> => {
  const kiloByte = 1024;
  // TODO: configure devprod filesize flag
  const maxSize = 150 * kiloByte;
  if (buffer.byteLength > maxSize) {
    return failure({ tag: "Size Error" });
  } else {
    return success(buffer);
  }
};

/**
 * Helper function concating all the PapaParse errors
 */
const formatPapaParseErrors = (errors: Papa.ParseError[]) =>
  errors
    .map((error) => `${error.message}: ${error.row}\n`)
    .reduce((result, errStr) => {
      result.concat(errStr);
      return result;
    });

/**
 * Takes a CSV buffer and returns it parsed. Can return data or error.
 */
const papaParse = (buffer: ArrayBuffer): Result<unknown, BrokenFileError> => {
  const papares = Papa.parse(Buffer.from(buffer).toString(), {
    header: true,
    skipEmptyLines: true,
  });

  if (papares.errors.length > 0) {
    return failure({
      tag: "Broken file",
      message: formatPapaParseErrors(papares.errors),
    });
  } else {
    return success(papares.data);
  }
};

/**
 * Checks to make sure that the CSV is in the format we want
 */
const correctlyFormattedCsv = (
  data: unknown,
): Result<schema.SourceRow[], BadFormatCSV> => {
  const r = schema.sourceRow
    .array()
    .nonempty({ message: "Could not parse CSV" })
    .safeParse(data);
  if (r.success) return success(r.data);
  else
    return failure({ tag: "Poorly formatted CSV", message: r.error.message });
};

/**
 * Takes raw file data and performs basic parsing / checks (light validation for UX).
 * Server-side will do comprehensive security validation.
 */
const parseCsv = async (
  file: File,
): Promise<Result<schema.SourceRow[], CSVErrors>> => {
  const buffer = await file.arrayBuffer();

  // Basic size check for immediate feedback
  const isCorrectSize = sizeCheck(buffer);
  if (isCorrectSize.tag === "failure") {
    return isCorrectSize;
  }

  // Basic parsing
  const csv = papaParse(buffer);
  if (csv.tag === "failure") {
    return csv;
  }

  // Schema validation
  const correctFormat = correctlyFormattedCsv(csv.value);
  return correctFormat;
};

/**
 * Hook for parsing csv files for creating reports - returns an async state
 */
export function useParseCsv(
  files: FileList | undefined,
): AsyncState<schema.SourceRow[], CSVErrors> {
  const file = files?.item(0) || undefined;

  return useAsyncState(parseCsv, file);
}
