/**
 * Shared utility functions for pipeline steps
 */

import type OpenAI from "openai";
import type { Logger } from "pino";
import { failure, type Result, success } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import * as weave from "weave";

const utilsLogger = logger.child({ module: "pipeline-utils" });

// Model cost configuration
// Currently only gpt-4o-mini is supported
const COST_BY_MODEL: Record<string, { in_per_1K: number; out_per_1K: number }> =
  {
    "gpt-4o-mini": { in_per_1K: 0.00015, out_per_1K: 0.0006 },
  };

/**
 * Error class for unknown model in cost calculation
 */
export class UnknownModelError extends Error {
  constructor(modelName: string) {
    super(`Unknown model for cost calculation: ${modelName}`);
    this.name = "UnknownModelError";
  }
}

/**
 * Returns the cost for the current model running the given numbers of
 * tokens in/out for this call
 *
 * @param modelName - The name of the model being used
 * @param tokIn - Number of input tokens
 * @param tokOut - Number of output tokens
 * @returns Result containing cost in dollars, or error if model is unknown
 */
export function tokenCost(
  modelName: string,
  tokIn: number,
  tokOut: number,
): Result<number, UnknownModelError> {
  if (!(modelName in COST_BY_MODEL)) {
    utilsLogger.error({ modelName }, "Unknown model for cost calculation");
    return failure(new UnknownModelError(modelName));
  }
  const cost =
    0.001 *
    (tokIn * COST_BY_MODEL[modelName].in_per_1K +
      tokOut * COST_BY_MODEL[modelName].out_per_1K);
  return success(cost);
}

/**
 * Create a logger with report context for better debugging across concurrent reports
 *
 * @param module - Module name for logging context
 * @param userId - Optional user ID for context
 * @param reportId - Optional report ID for context
 * @returns Pino logger with context
 */
export function getReportLogger(
  module: string,
  userId?: string,
  reportId?: string,
): Logger {
  const context: Record<string, string> = { module };
  if (userId) {
    context.userId = userId;
  }
  if (reportId) {
    context.reportId = reportId;
  }
  return logger.child(context);
}

/**
 * Process a batch of items concurrently with concurrency limiting
 *
 * This utility processes items in batches with a maximum concurrency limit,
 * useful for rate-limited API calls or memory-constrained operations.
 *
 * @param items - Array of items to process
 * @param processor - Async function to process each item
 * @param concurrency - Maximum number of concurrent operations
 * @returns Promise that resolves to array of results in the same order as input
 *
 * @example
 * const results = await processBatchConcurrently(
 *   comments,
 *   async (comment) => await processComment(comment),
 *   6  // Process up to 6 comments concurrently
 * );
 */
export async function processBatchConcurrently<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const executing: Set<Promise<void>> = new Set();

  for (let i = 0; i < items.length; i++) {
    const index = i;
    const promise = processor(items[i])
      .then((result) => {
        results[index] = result;
      })
      .catch((error) => {
        utilsLogger.error(
          { error, index, item: items[i] },
          "Error processing item in batch",
        );
        throw error;
      })
      .finally(() => {
        executing.delete(promise);
      });

    executing.add(promise);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Initialize Weave for scoring if enabled and wrap the OpenAI responses.create function
 *
 * @param openaiClient - OpenAI client instance
 * @param enableScoring - Whether to enable Weave scoring
 * @param weaveProjectName - Name of the Weave project to log to
 * @returns The responses.create function, wrapped with weave.op if scoring is enabled
 */
export async function initializeWeaveIfEnabled(
  openaiClient: OpenAI,
  enableScoring: boolean,
  weaveProjectName: string,
): Promise<OpenAI["responses"]["create"]> {
  let responsesCreate = openaiClient.responses.create;

  if (enableScoring) {
    try {
      await weave.init(weaveProjectName);
      responsesCreate = weave.op(responsesCreate);
    } catch (error) {
      logger.error(
        { error, weaveProjectName, module: "weave-init" },
        "Failed to initialize Weave",
      );
    }
  }

  return responsesCreate;
}
