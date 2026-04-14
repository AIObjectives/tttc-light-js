/**
 * Utility functions for clustering pipeline step
 */

import type { Logger } from "pino";
import { logger } from "tttc-common/logger";

// Configuration constants
const MIN_WORD_COUNT_FOR_MEANING = 3;
const MIN_CHAR_COUNT_FOR_MEANING = 10;

/**
 * Check whether the raw comment contains enough words/characters
 * to be meaningful in web app mode. Only check word count for short comments.
 * TODO: add config for other modes like elicitation/direct response
 *
 * @param rawComment - The raw comment text to validate
 * @returns true if the comment is meaningful, false otherwise
 */
export function commentIsMeaningful(rawComment: string): boolean {
  if (
    rawComment.length >= MIN_CHAR_COUNT_FOR_MEANING ||
    rawComment.split(" ").length >= MIN_WORD_COUNT_FOR_MEANING
  ) {
    return true;
  }
  return false;
}

/**
 * Create a logger with report context for better debugging across concurrent reports
 *
 * @param userId - Optional user ID for context
 * @param reportId - Optional report ID for context
 * @returns Pino logger with context
 */
export function getReportLogger(userId?: string, reportId?: string): Logger {
  const context: Record<string, string> = { module: "clustering" };
  if (userId) {
    context.userId = userId;
  }
  if (reportId) {
    context.reportId = reportId;
  }
  return logger.child(context);
}

interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/**
 * Extract token usage from usage object.
 * Returns (0, 0, 0) if usage is null or missing required fields.
 *
 * @param usage - Usage object from OpenAI API or cache
 * @returns Tuple of [prompt_tokens, completion_tokens, total_tokens]
 */
export function extractTokenUsage(
  usage: TokenUsage | null | undefined,
): [number, number, number] {
  if (!usage) {
    return [0, 0, 0];
  }

  return [
    usage.prompt_tokens ?? 0,
    usage.completion_tokens ?? 0,
    usage.total_tokens ?? 0,
  ];
}
