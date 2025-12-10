/**
 * Minimal prompt sanitization focused on specific risks not covered by OpenAI's safety systems.
 * OpenAI already handles most content safety - we focus on prompt injection and basic validation.
 * Also includes PII filtering to protect user privacy in the final report outputs.
 */

import { logger } from "tttc-common/logger";

const sanitizerLogger = logger.child({ module: "clustering-sanitizer" });

export interface SanitizeResult {
  sanitizedText: string;
  isSafe: boolean;
}

// Reasonable limits
const MAX_COMMENT_LENGTH = 10000; // Generous but prevents abuse
const MAX_PROMPT_LENGTH = 100000; // OpenAI has its own limits anyway

// Simple configuration
const ENABLE_PII_FILTERING =
  process.env.ENABLE_PII_FILTERING?.toLowerCase() !== "false";

// Focus on prompt injection patterns that could manipulate system behavior
// OpenAI handles content safety, we handle prompt structure attacks
const INJECTION_PATTERNS = [
  /\bignore\s+(all\s+)?(previous|above|earlier)\s+(instructions?|prompts?)/i,
  /\b(system|assistant|ai)\s*:\s*/i,
  /\byou\s+are\s+(now|actually)\s+/i,
  /\bact\s+as\s+(if\s+)?you\s+(are|were)\s+/i,
  /\bpretend\s+(to\s+be|you\s+are)\s+/i,
];

// PII patterns for protecting user privacy in final reports
// Not for OpenAI safety - for report output privacy
const PII_PATTERNS: Array<[RegExp, string]> = [
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL]"], // Email addresses
  [/\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "[PHONE]"], // Phone numbers
  [/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]"], // SSN format
  [/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[CARD]"], // Credit card format
];

/**
 * Filter PII from text to protect user privacy in final reports.
 * This is not for OpenAI safety - it's for report output privacy.
 */
export function filterPII(text: string): string {
  if (!ENABLE_PII_FILTERING) {
    return text;
  }

  let filteredText = text;
  for (const [pattern, replacement] of PII_PATTERNS) {
    filteredText = filteredText.replace(pattern, replacement);
  }

  return filteredText;
}

/**
 * Minimal sanitization focusing on prompt injection and basic validation.
 * Optionally filters PII for report output privacy.
 *
 * @param text - Input text to sanitize
 * @param context - Context for logging
 * @param filterPIIFlag - Whether to apply PII filtering (default true)
 * @returns Tuple of (sanitizedText, isSafe)
 */
export function basicSanitize(
  text: string,
  context: string = "",
  filterPIIFlag: boolean = true,
): SanitizeResult {
  if (typeof text !== "string") {
    return { sanitizedText: "", isSafe: false };
  }

  let sanitizedText = text;

  // Basic length check
  if (text.length > MAX_COMMENT_LENGTH) {
    sanitizerLogger.warn(
      { context, length: text.length, maxLength: MAX_COMMENT_LENGTH },
      "Oversized input detected",
    );
    sanitizedText = text.substring(0, MAX_COMMENT_LENGTH);
  }

  // Empty or too short
  if (sanitizedText.trim().length < 3) {
    return { sanitizedText: "", isSafe: false };
  }

  // Check for basic prompt injection attempts
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitizedText)) {
      sanitizerLogger.warn(
        { context, pattern: pattern.toString() },
        "Potential prompt injection detected",
      );
      return { sanitizedText: "", isSafe: false };
    }
  }

  // Apply PII filtering if requested
  if (filterPIIFlag) {
    sanitizedText = filterPII(sanitizedText);
  }

  return { sanitizedText: sanitizedText.trim(), isSafe: true };
}

/**
 * Simple prompt length limiting.
 */
export function sanitizePromptLength(prompt: string): string {
  if (prompt.length > MAX_PROMPT_LENGTH) {
    sanitizerLogger.warn(
      { length: prompt.length, maxLength: MAX_PROMPT_LENGTH },
      "Truncating oversized prompt",
    );
    return prompt.substring(0, MAX_PROMPT_LENGTH);
  }
  return prompt;
}

/**
 * Sanitize a data structure for final output by filtering PII from text fields.
 * Use this on the final report JSON before returning to client.
 *
 * @param data - Dictionary containing report data
 * @returns Dictionary with PII filtered from text content
 */
export function sanitizeForOutput<T>(data: T): T {
  if (!ENABLE_PII_FILTERING) {
    return data;
  }

  function filterDictValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === "string") {
      return filterPII(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => filterDictValues(item));
    }

    if (typeof obj === "object") {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = filterDictValues(value);
      }
      return result;
    }

    return obj;
  }

  return filterDictValues(data);
}
