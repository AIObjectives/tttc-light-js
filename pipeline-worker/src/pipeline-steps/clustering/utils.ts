/**
 * Utility functions for clustering pipeline step
 */

import type { Logger } from "pino";
import { logger } from "tttc-common/logger";

const utilsLogger = logger.child({ module: "clustering-utils" });

// Configuration constants
const MIN_WORD_COUNT_FOR_MEANING = 3;
const MIN_CHAR_COUNT_FOR_MEANING = 10;

// Model cost configuration
const COST_BY_MODEL: Record<string, { in_per_1K: number; out_per_1K: number }> =
  {
    // GPT-4o mini: Input is $0.150 / 1M tokens, Output is $0.600 / 1M tokens
    // or: input is $0.00015/1K tokens, output is $0.0006/1K tokens
    "gpt-4o-mini": { in_per_1K: 0.00015, out_per_1K: 0.0006 },
    // GPT-4o: Input is $2.50 / 1M tokens, Output is $10.00/1M tokens
    // or: input is $0.0025/1K tokens, output is $0.01/1K tokens
    "gpt-4o": { in_per_1K: 0.0025, out_per_1K: 0.01 },
    // GPT-4 Turbo: Input is $10.00 / 1M tokens, Output is $30.00/1M tokens
    "gpt-4-turbo": { in_per_1K: 0.01, out_per_1K: 0.03 },
    // GPT-4: Input is $30.00 / 1M tokens, Output is $60.00/1M tokens
    "gpt-4": { in_per_1K: 0.03, out_per_1K: 0.06 },
    // GPT-3.5 Turbo: Input is $0.50 / 1M tokens, Output is $1.50/1M tokens
    "gpt-3.5-turbo": { in_per_1K: 0.0005, out_per_1K: 0.0015 },
  };

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
 * Returns the cost for the current model running the given numbers of
 * tokens in/out for this call
 *
 * @param modelName - The name of the model being used
 * @param tokIn - Number of input tokens
 * @param tokOut - Number of output tokens
 * @returns Cost in dollars, or -1 if model is undefined
 */
export function tokenCost(
  modelName: string,
  tokIn: number,
  tokOut: number,
): number {
  if (!(modelName in COST_BY_MODEL)) {
    utilsLogger.error({ modelName }, "Unknown model for cost calculation");
    return -1;
  }
  return (
    0.001 *
    (tokIn * COST_BY_MODEL[modelName].in_per_1K +
      tokOut * COST_BY_MODEL[modelName].out_per_1K)
  );
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

/**
 * Extract token usage from usage object.
 * Returns (0, 0, 0) if usage is null or missing required fields.
 *
 * @param usage - Usage object from OpenAI API or cache
 * @returns Tuple of [prompt_tokens, completion_tokens, total_tokens]
 */
export function extractTokenUsage(usage: any): [number, number, number] {
  if (!usage) {
    return [0, 0, 0];
  }

  return [
    usage.prompt_tokens ?? 0,
    usage.completion_tokens ?? 0,
    usage.total_tokens ?? 0,
  ];
}
