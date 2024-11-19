"use client";

/**
 * useParseCSV
 * We use PapaParse to parse the raw file data into an array of objects, and then Zod to ensure correct type-safety
 * Right now intended only for the CreateReport component during the data upload section. Can be extended to be more generalizable in the future if necessary.
 * There's some somewhat questionable FP standins that would be better if we actually used a full FP library. Go back and redo this in the future if we do.
 */

import { useAsyncState } from "@src/lib/hooks/useAsyncState";
import Papa from "papaparse";
import * as schema from "tttc-common/schema";
import { z, SafeParseReturnType } from "zod";

/**
 * Shape of error that can be returned by useParseCSV. Use this to build specific errors
 */
const csvError = (tag: string) =>
  z.object({ tag: z.literal(tag), message: z.string().optional() });

/**
 * Zod error - row does not match intended shape.
 */
const badFormatCsv = csvError("Poorly formatted CSV");

/**
 * PapaParse threw an error trying to parse the file.
 */
const brokenFile = csvError("Broken file");

type BrokenFileError = z.infer<typeof brokenFile>;

/**
 * Union of possible errors
 */
const CsvErrors = z.union([badFormatCsv, brokenFile]);

type CSVErrors = z.infer<typeof CsvErrors>;

/**
 * Takes a CSV buffer and returns it parsed. Can return data or error.
 */
const papaParse = (buffer: ArrayBuffer): Papa.ParseResult<unknown> =>
  Papa.parse(Buffer.from(buffer).toString(), {
    header: true,
    skipEmptyLines: true,
  });

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
 * Unwraps Data or CSVError from Papa.ParseResult.
 */
const unwrapPapaParse = (
  parseResult: Papa.ParseResult<unknown>,
): unknown | BrokenFileError =>
  parseResult.errors.length > 0
    ? { tag: "Broken file", message: formatPapaParseErrors(parseResult.errors) }
    : parseResult.data;

/**
 * Unwraps Data or CSVError from Zod parser.
 */
const unwrapZodParse =
  <Input, Output>(errorType: CSVErrors) =>
  (parseResult: SafeParseReturnType<Input, Output>): Output | CSVErrors =>
    parseResult.success
      ? (parseResult.data as Output)
      : { ...errorType, message: parseResult.error.message };

/**
 * If an error has happened previously in the pipeline, short-circuit.
 */
const pipe =
  <Data, Returns, Error extends CSVErrors>(cb: (data: Data) => Returns) =>
  (res: Data | Error) =>
    CsvErrors.safeParse(res).success ? (res as Error) : cb(res as Data);

/**
 * Pipeline for parsing CSV. Returns either some data or an error
 */
const parseCSV = async (file: File): Promise<unknown | BrokenFileError> =>
  file.arrayBuffer().then(papaParse).then(unwrapPapaParse);

/**
 * Parse and then Zod-parse the data to ensure its the correct shape.
 */
const parseDataCsv = async (
  file: File,
): Promise<schema.SourceRow[] | CSVErrors> =>
  parseCSV(file)
    .then(
      pipe(
        schema.sourceRow.array().nonempty({ message: "Could not parse CSV" })
          .safeParse,
      ),
    )
    .then(pipe(unwrapZodParse({ tag: "Poorly formatted CSV" })));

/**
 * Hook for parsing CSV data.
 */
export function useParseCsv(files: FileList | undefined) {
  const input = files?.item(0) || undefined;
  if (input === undefined) return { isLoading: false, result: undefined };
  return useAsyncState(
    async () => parseDataCsv(input),
    [input?.name, input?.lastModified],
    schema.sourceRow.array(),
  );
}
