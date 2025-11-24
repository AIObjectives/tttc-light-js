"use client";

/**
 * useParseCSV
 * We use PapaParse to parse the raw file data into an array of objects, and then validate using the csv-validation module
 * Right now intended only for the CreateReport component during the data upload section. Can be extended to be more generalizable in the future if necessary.
 * There's some somewhat questionable FP standins that would be better if we actually used a full FP library. Go back and redo this in the future if we do.
 */

import { useCallback } from "react";
import { AsyncState, useAsyncState } from "@/lib/hooks/useAsyncState";
import Papa from "papaparse";
import * as schema from "tttc-common/schema";
import { z } from "zod";
import { failure, success, Result } from "tttc-common/functional-utils";
import { DEFAULT_LIMITS } from "tttc-common/permissions";
import { validateCSVFormat, ColumnMappings } from "tttc-common/csv-validation";

/**
 * Shape of error that can be returned by useParseCSV. Use this to build specific errors
 */
const csvError = <T extends string>(tag: T) =>
  z.object({ tag: z.literal(tag), message: z.string().optional() });

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
 * Invalid CSV - missing required columns, cannot proceed
 */
const invalidCsv = z.object({
  tag: z.literal("Invalid CSV"),
  missingColumns: z.array(z.string()),
  suggestions: z.array(z.string()),
  detectedHeaders: z.array(z.string()),
});

type InvalidCSV = z.infer<typeof invalidCsv>;

/**
 * Non-standard format - can proceed but shows warning with mappings
 */
const nonStandardFormat = z.object({
  tag: z.literal("Non-standard format"),
  mappings: z.custom<ColumnMappings>(),
  warnings: z.array(z.string()),
  data: z.custom<schema.SourceRow[]>(),
});

type NonStandardFormat = z.infer<typeof nonStandardFormat>;

/**
 * Union of possible errors
 */
const CsvErrors = z.union([
  invalidCsv,
  nonStandardFormat,
  brokenFile,
  sizeError,
]);

type CSVErrors = z.infer<typeof CsvErrors>;

/**
 * Check file size against the provided limit
 */
const sizeCheck = (
  buffer: ArrayBuffer,
  maxSize: number,
): Result<ArrayBuffer, SizeError> => {
  if (buffer.byteLength > maxSize) {
    return failure({ tag: "Size Error" });
  } else {
    return success(buffer);
  }
};

/**
 * Helper function concatenating all the PapaParse errors
 */
const formatPapaParseErrors = (errors: Papa.ParseError[]) =>
  errors.map((error) => `${error.message}: ${error.row}\n`).join("");

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
 * Validates CSV structure using the new validation module
 * Returns success, warning (non-standard but mappable), or error (invalid)
 */
const validateCsvStructure = (
  data: unknown,
): Result<schema.SourceRow[], InvalidCSV | NonStandardFormat> => {
  // Validate that data is an array of records
  if (!Array.isArray(data)) {
    return failure({
      tag: "Invalid CSV",
      missingColumns: ["all"],
      suggestions: ["CSV must contain data rows"],
      detectedHeaders: [],
    });
  }

  // Validate that array contains objects (not primitives or null)
  // Note: typeof null === "object" in JavaScript, so we check for null explicitly
  if (data.length > 0 && (data[0] === null || typeof data[0] !== "object")) {
    return failure({
      tag: "Invalid CSV",
      missingColumns: ["all"],
      suggestions: ["CSV rows must be objects with named columns"],
      detectedHeaders: [],
    });
  }
  const result = validateCSVFormat(data as Record<string, unknown>[]);

  if (result.status === "error") {
    return failure({
      tag: "Invalid CSV",
      missingColumns: result.missingColumns,
      suggestions: result.suggestions,
      detectedHeaders: result.detectedHeaders,
    });
  }

  if (result.status === "warning") {
    return failure({
      tag: "Non-standard format",
      mappings: result.mappings,
      warnings: result.warnings,
      data: result.data,
    });
  }

  // Success - standard format
  return success(result.data);
};

/**
 * Takes raw file data and performs basic parsing / checks (light validation for UX).
 * Server-side will do comprehensive security validation.
 */
const parseCsv = async (
  file: File,
  maxSize: number,
): Promise<Result<schema.SourceRow[], CSVErrors>> => {
  const buffer = await file.arrayBuffer();

  // Basic size check for immediate feedback
  const isCorrectSize = sizeCheck(buffer, maxSize);
  if (isCorrectSize.tag === "failure") {
    return isCorrectSize;
  }

  // Basic parsing
  const csv = papaParse(buffer);
  if (csv.tag === "failure") {
    return csv;
  }

  // CSV structure validation with column mapping detection
  const validationResult = validateCsvStructure(csv.value);
  return validationResult;
};

/**
 * Hook for parsing csv files for creating reports - returns an async state
 * @param files - The FileList from file input
 * @param maxSize - Maximum allowed file size in bytes
 */
export function useParseCsv(
  files: FileList | undefined,
  maxSize: number = DEFAULT_LIMITS.csvSizeLimit,
): AsyncState<schema.SourceRow[], CSVErrors> {
  const file = files?.item(0) || undefined;

  const parseCsvCallback = useCallback(
    (file: File) => parseCsv(file, maxSize),
    [maxSize],
  );

  return useAsyncState(parseCsvCallback, file);
}
