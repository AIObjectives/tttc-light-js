/**
 * CSV Security Validation Module
 * Provides comprehensive input sanitization and validation for CSV files
 */

import { z } from "zod";
import { Result, success, failure } from "../functional-utils";

// Security configuration constants
export const CSV_SECURITY_CONFIG = {
  MAX_FILE_SIZE: 150 * 1024, // 150KB limit
  MAX_ROWS: 10000,
  MAX_COLUMNS: 50,
  MAX_CELL_LENGTH: 32000,
  MAX_FIELD_COUNT: 1000000, // Papa Parse field count limit
  ALLOWED_ENCODINGS: ["utf-8", "utf8", "ascii"],
} as const;

// Security error types
export const csvSecurityError = <T extends string>(tag: T) =>
  z.object({
    tag: z.literal(tag),
    message: z.string(),
    severity: z.enum(["high", "medium", "low"]).optional(),
  });

export const csvBombError = csvSecurityError("CSV_BOMB_DETECTED" as const);
export const injectionError = csvSecurityError("INJECTION_ATTEMPT" as const);
export const encodingError = csvSecurityError("INVALID_ENCODING" as const);
export const oversizeError = csvSecurityError("OVERSIZE_CONTENT" as const);
export const malformedError = csvSecurityError("MALFORMED_STRUCTURE" as const);

export type CSVSecurityError =
  | z.infer<typeof csvBombError>
  | z.infer<typeof injectionError>
  | z.infer<typeof encodingError>
  | z.infer<typeof oversizeError>
  | z.infer<typeof malformedError>;

/**
 * Detects potential CSV injection attacks
 * Checks for formula injection patterns that could execute in spreadsheet applications
 */
export function detectCSVInjection(content: string): boolean {
  const dangerousPatterns = [
    /^=.*$/, // Excel formulas
    /^\+.*$/, // Calc formulas
    /^-.*$/, // Calc formulas
    /^@.*$/, // Calc formulas
    /^\t=.*$/, // Tab-prefixed formulas
    /DDE\s*\(/i, // Dynamic Data Exchange
    /cmd\s*\|/i, // Command injection
    /powershell/i, // PowerShell execution
    /javascript:/i, // JavaScript protocol
    /data:.*base64/i, // Data URI with base64
    /<script/i, // Script tags
    /vbscript:/i, // VBScript protocol
  ];

  return dangerousPatterns.some((pattern) => pattern.test(content.trim()));
}

/**
 * Sanitizes cell content by removing potentially dangerous characters
 */
export function sanitizeCSVCell(content: string): string {
  if (typeof content !== "string") {
    return String(content);
  }

  // Remove dangerous formula prefixes
  let sanitized = content.replace(/^[=+\-@]/, "'$&");

  // Remove or escape dangerous patterns
  sanitized = sanitized
    .replace(/javascript:/gi, "js:")
    .replace(/vbscript:/gi, "vbs:")
    .replace(/data:.*base64/gi, "data-removed")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "[script-removed]")
    .replace(/DDE\s*\(/gi, "DDE-removed(")
    .replace(/cmd\s*\|/gi, "cmd-removed|");

  // Limit length to prevent buffer overflow
  if (sanitized.length > CSV_SECURITY_CONFIG.MAX_CELL_LENGTH) {
    sanitized =
      sanitized.substring(0, CSV_SECURITY_CONFIG.MAX_CELL_LENGTH) + "...";
  }

  return sanitized;
}

/**
 * Validates CSV structure for potential CSV bomb attacks
 */
export function validateCSVStructure(
  buffer: ArrayBuffer,
): Result<ArrayBuffer, CSVSecurityError> {
  const content = Buffer.from(buffer).toString("utf8");

  // Check file size
  if (buffer.byteLength > CSV_SECURITY_CONFIG.MAX_FILE_SIZE) {
    return failure({
      tag: "OVERSIZE_CONTENT",
      message: `File size ${buffer.byteLength} exceeds limit of ${CSV_SECURITY_CONFIG.MAX_FILE_SIZE} bytes`,
      severity: "high",
    });
  }

  // Count rows and estimate columns
  const lines = content.split(/\r?\n/);
  if (lines.length > CSV_SECURITY_CONFIG.MAX_ROWS) {
    return failure({
      tag: "CSV_BOMB_DETECTED",
      message: `Row count ${lines.length} exceeds limit of ${CSV_SECURITY_CONFIG.MAX_ROWS}`,
      severity: "high",
    });
  }

  // Estimate column count from first non-empty line
  const firstDataLine = lines.find((line) => line.trim().length > 0);
  if (firstDataLine) {
    const estimatedColumns = firstDataLine.split(",").length;
    if (estimatedColumns > CSV_SECURITY_CONFIG.MAX_COLUMNS) {
      return failure({
        tag: "CSV_BOMB_DETECTED",
        message: `Column count ${estimatedColumns} exceeds limit of ${CSV_SECURITY_CONFIG.MAX_COLUMNS}`,
        severity: "high",
      });
    }
  }

  // Check for suspicious patterns that might indicate CSV bombs
  const suspiciousPatterns = [
    /,{100,}/, // Many consecutive commas
    /"{100,}/, // Many consecutive quotes
    /\n{1000,}/, // Many consecutive newlines
    /.{100000,}/, // Extremely long lines
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      return failure({
        tag: "CSV_BOMB_DETECTED",
        message:
          "Suspicious repeating patterns detected that may indicate a CSV bomb",
        severity: "high",
      });
    }
  }

  return success(buffer);
}

/**
 * Validates file encoding to prevent encoding-based attacks
 */
export function validateEncoding(
  buffer: ArrayBuffer,
): Result<string, CSVSecurityError> {
  try {
    // Try UTF-8 first (most common)
    const content = Buffer.from(buffer).toString("utf8");

    // Check for replacement characters indicating invalid UTF-8
    if (content.includes("\uFFFD")) {
      return failure({
        tag: "INVALID_ENCODING",
        message: "File contains invalid UTF-8 sequences",
        severity: "medium",
      });
    }

    // Check for BOM and other potential issues
    if (content.startsWith("\uFEFF")) {
      // UTF-8 BOM is generally OK, just strip it
      return success(content.substring(1));
    }

    return success(content);
  } catch (error) {
    return failure({
      tag: "INVALID_ENCODING",
      message: "Unable to decode file with supported encodings",
      severity: "high",
    });
  }
}

/**
 * Secure Papa Parse configuration factory
 * Returns configuration object with security settings
 */
export const createSecurePapaParseConfig = (
  options: {
    enableSanitization?: boolean;
    maxRows?: number;
  } = {},
) => ({
  header: true,
  skipEmptyLines: true,
  // Security settings
  skipLinesWithError: false, // We want to know about errors
  dynamicTyping: false, // Prevent automatic type conversion
  ...(options.enableSanitization && {
    transform: sanitizeCSVCell, // Sanitize each cell
    transformHeader: sanitizeCSVCell, // Sanitize headers too
  }),
  // Performance limits
  chunkSize: 10000, // Process in chunks
  preview: options.maxRows || CSV_SECURITY_CONFIG.MAX_ROWS, // Limit rows processed
  // Error handling
  error: (error: any) => {
    console.warn("Papa Parse error:", error);
  },
});

/**
 * Validates parsed CSV data for injection attempts
 */
export function validateParsedData(
  data: unknown[],
): Result<unknown[], CSVSecurityError> {
  if (!Array.isArray(data)) {
    return failure({
      tag: "MALFORMED_STRUCTURE",
      message: "Parsed data is not an array",
      severity: "high",
    });
  }

  // Check each row for injection attempts
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (typeof row === "object" && row !== null) {
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === "string" && detectCSVInjection(value)) {
          return failure({
            tag: "INJECTION_ATTEMPT",
            message: `Potential injection detected in row ${i + 1}, column "${key}": ${value.substring(0, 50)}...`,
            severity: "high",
          });
        }
      }
    }
  }

  return success(data);
}

/**
 * Complete security validation pipeline for CSV files
 */
export async function validateCSVSecurity(
  file: File,
): Promise<Result<string, CSVSecurityError>> {
  try {
    const buffer = await file.arrayBuffer();

    // Step 1: Validate structure for CSV bombs
    const structureResult = validateCSVStructure(buffer);
    if (structureResult.tag === "failure") {
      return structureResult;
    }

    // Step 2: Validate encoding
    const encodingResult = validateEncoding(buffer);
    if (encodingResult.tag === "failure") {
      return encodingResult;
    }

    return success(encodingResult.value);
  } catch (error) {
    return failure({
      tag: "MALFORMED_STRUCTURE",
      message: `Failed to process file: ${error instanceof Error ? error.message : "Unknown error"}`,
      severity: "high",
    });
  }
}
