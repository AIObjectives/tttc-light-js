import type { SourceRow } from "../schema";

/**
 * Column name mapping configurations
 * First match in each array wins (precedence order)
 */
export const COLUMN_MAPPINGS = {
  ID: ["id", "comment-id", "row-id", "i"],
  COMMENT: ["comment", "comment-body", "response", "answer", "text"],
  INTERVIEW: [
    "interview",
    "name",
    "extraquestion1", // WhatsApp format
    "speaker name",
    "speaker-name",
    "author",
    "speaker-id",
    "speaker_id",
  ],
  VIDEO: ["video"],
  TIMESTAMP: ["timestamp"],
} as const;

/**
 * Standard (preferred) column names for each field
 */
const STANDARD_COLUMNS = {
  ID: "id",
  COMMENT: "comment",
  INTERVIEW: "interview",
  VIDEO: "video",
  TIMESTAMP: "timestamp",
} as const;

/**
 * Information about a detected column mapping
 */
export interface ColumnMapping {
  /** The actual column name found in the CSV */
  detected: string | null;
  /** Whether this is the standard/preferred column name */
  isStandard: boolean;
  /** For ID column: whether we're using row index as fallback */
  usingFallback?: boolean;
}

/**
 * Complete set of detected column mappings
 */
export interface ColumnMappings {
  comment: ColumnMapping;
  id: ColumnMapping;
  interview: ColumnMapping;
  video: ColumnMapping;
  timestamp: ColumnMapping;
}

/**
 * Successful validation result
 */
export interface ValidationSuccess {
  status: "success";
  mappings: ColumnMappings;
  data: SourceRow[];
  /** Optional warnings (e.g., "Using row numbers as IDs") */
  warnings?: string[];
}

/**
 * Warning validation result (non-standard format but can proceed)
 */
export interface ValidationWarning {
  status: "warning";
  mappings: ColumnMappings;
  data: SourceRow[];
  /** Warnings to show user */
  warnings: string[];
}

/**
 * Error validation result (cannot proceed)
 */
export interface ValidationError {
  status: "error";
  /** Which required columns are missing */
  missingColumns: string[];
  /** Suggested valid column names */
  suggestions: string[];
  /** Actual columns detected in the CSV */
  detectedHeaders: string[];
}

/**
 * Union type for all validation results
 */
export type ValidationResult =
  | ValidationSuccess
  | ValidationWarning
  | ValidationError;

/**
 * Detects which column mapping was used for a given field
 * @param lowerKeys - Map of lowercase column names to actual column names
 * @param acceptedNames - Array of accepted column names (in precedence order)
 * @param standardName - The standard/preferred column name
 * @returns ColumnMapping with detection information
 */
function detectColumn(
  lowerKeys: Map<string, string>,
  acceptedNames: readonly string[],
  standardName: string,
): ColumnMapping {
  const detected = acceptedNames
    .map((col) => lowerKeys.get(col.toLowerCase()))
    .find((matchedKey) => matchedKey);

  if (!detected) {
    return { detected: null, isStandard: false };
  }

  return {
    detected,
    isStandard: detected.toLowerCase() === standardName.toLowerCase(),
  };
}

/**
 * Validates CSV format and detects column mappings
 * Returns detailed validation result with mappings and warnings
 *
 * Note: Renamed from validateCSVStructure to avoid naming conflict with
 * csv-security module's validateCSVStructure (which checks for CSV bombs).
 * This function checks for valid column mappings and format compatibility.
 *
 * @param data - Parsed CSV data as array of objects
 * @returns ValidationResult indicating success, warning, or error
 *
 * @example
 * // Standard format - returns success
 * const result1 = validateCSVFormat([
 *   { id: "1", comment: "Great idea!", interview: "Alice" },
 *   { id: "2", comment: "I agree", interview: "Bob" }
 * ]);
 * // => { status: "success", mappings: {...}, data: [...] }
 *
 * @example
 * // Non-standard but mappable format - returns warning
 * const result2 = validateCSVFormat([
 *   { "comment-body": "text", name: "Alice" },
 *   { "comment-body": "more text", name: "Bob" }
 * ]);
 * // => {
 * //   status: "warning",
 * //   mappings: { comment: { detected: "comment-body", isStandard: false }, ... },
 * //   warnings: ['Using "comment-body" column for participant comments (non-standard)', ...],
 * //   data: [...]
 * // }
 *
 * @example
 * // Invalid format - missing required column - returns error
 * const result3 = validateCSVFormat([
 *   { id: "1", feedback: "This has no comment column" }
 * ]);
 * // => {
 * //   status: "error",
 * //   missingColumns: ["comment"],
 * //   suggestions: ["comment", "comment-body", "response", "answer", "text"],
 * //   detectedHeaders: ["id", "feedback"]
 * // }
 *
 * @example
 * // WhatsApp format - returns warning due to non-standard names
 * const result4 = validateCSVFormat([
 *   { response: "Hello", extraquestion1: "Speaker A" }
 * ]);
 * // => {
 * //   status: "warning",
 * //   mappings: {
 * //     comment: { detected: "response", isStandard: false },
 * //     id: { detected: null, isStandard: false, usingFallback: true },
 * //     interview: { detected: "extraquestion1", isStandard: false },
 * //     ...
 * //   },
 * //   warnings: [...],
 * //   data: [{ id: "0", comment: "Hello", interview: "Speaker A" }]
 * // }
 */
export function validateCSVFormat(
  data: Record<string, unknown>[],
): ValidationResult {
  // Check for empty data
  if (!data || !data.length) {
    return {
      status: "error",
      missingColumns: ["all"],
      suggestions: ["CSV file must contain data rows"],
      detectedHeaders: [],
    };
  }

  const keys = Object.keys(data[0]);
  const lowerKeys = new Map(keys.map((k) => [k.toLowerCase(), k]));

  // Detect all column mappings
  const commentMapping = detectColumn(
    lowerKeys,
    COLUMN_MAPPINGS.COMMENT,
    STANDARD_COLUMNS.COMMENT,
  );
  const idMapping = detectColumn(
    lowerKeys,
    COLUMN_MAPPINGS.ID,
    STANDARD_COLUMNS.ID,
  );
  const interviewMapping = detectColumn(
    lowerKeys,
    COLUMN_MAPPINGS.INTERVIEW,
    STANDARD_COLUMNS.INTERVIEW,
  );
  const videoMapping = detectColumn(
    lowerKeys,
    COLUMN_MAPPINGS.VIDEO,
    STANDARD_COLUMNS.VIDEO,
  );
  const timestampMapping = detectColumn(
    lowerKeys,
    COLUMN_MAPPINGS.TIMESTAMP,
    STANDARD_COLUMNS.TIMESTAMP,
  );

  // HARD ERROR: Missing required comment column
  if (!commentMapping.detected) {
    return {
      status: "error",
      missingColumns: ["comment"],
      suggestions: [...COLUMN_MAPPINGS.COMMENT],
      detectedHeaders: keys,
    };
  }

  // Handle ID column fallback
  const finalIdMapping: ColumnMapping = idMapping.detected
    ? idMapping
    : {
        detected: null,
        isStandard: false,
        usingFallback: true,
      };

  const mappings: ColumnMappings = {
    comment: commentMapping,
    id: finalIdMapping,
    interview: interviewMapping,
    video: videoMapping,
    timestamp: timestampMapping,
  };

  // Format the data using detected mappings
  const formattedData = formatDataWithMappings(
    data,
    lowerKeys,
    commentMapping.detected,
    idMapping.detected,
    interviewMapping.detected,
    videoMapping.detected,
    timestampMapping.detected,
  );

  // Generate warnings for non-standard format
  const warnings: string[] = [];

  if (!commentMapping.isStandard) {
    warnings.push(
      `Using "${commentMapping.detected}" column for participant comments (non-standard)`,
    );
  }

  if (finalIdMapping.usingFallback) {
    warnings.push('No "ID" column detected - row numbers will be used as IDs');
  } else if (!idMapping.isStandard && idMapping.detected) {
    warnings.push(
      `Using "${idMapping.detected}" column for IDs (non-standard)`,
    );
  }

  if (!interviewMapping.detected) {
    warnings.push('No "speaker" column detected - responses will be anonymous');
  } else if (!interviewMapping.isStandard) {
    warnings.push(
      `Using "${interviewMapping.detected}" column for speaker names (non-standard)`,
    );
  }

  // Determine validation result based on warnings
  // Success: No warnings (standard format with all standard column names)
  // Warning: Has warnings (non-standard format but can be processed)
  if (warnings.length === 0) {
    return {
      status: "success",
      mappings,
      data: formattedData,
    };
  }

  return {
    status: "warning",
    mappings,
    data: formattedData,
    warnings,
  };
}

/**
 * Formats raw CSV data using detected column mappings
 * Internal helper function used by validateCSVFormat
 */
function formatDataWithMappings(
  data: Record<string, unknown>[],
  _lowerKeys: Map<string, string>,
  commentColumn: string,
  idColumn: string | null,
  interviewColumn: string | null,
  videoColumn: string | null,
  timestampColumn: string | null,
): SourceRow[] {
  return data.map((row, index: number): SourceRow => {
    const id = idColumn ? String(row[idColumn]) : String(index);
    const comment = String(row[commentColumn]);
    const res: SourceRow = { id, comment };

    if (videoColumn) {
      res.video = String(row[videoColumn]);
    }

    if (interviewColumn) {
      res.interview = String(row[interviewColumn]);
    }

    if (timestampColumn) {
      res.timestamp = String(row[timestampColumn]);
    }

    return res;
  });
}

/**
 * Formats raw CSV data with flexible column name mapping
 * @throws Error if comment column is missing or data is empty
 */
export function formatData(data: Record<string, unknown>[]): SourceRow[] {
  if (!data || !data.length) {
    throw Error("Invalid or empty data file");
  }

  const result = validateCSVFormat(data);

  if (result.status === "error") {
    throw Error(
      `The csv file must contain a comment column (valid column names: ${result.suggestions.join(", ")})`,
    );
  }

  return result.data;
}
