/**
 * Format pipeline runner output for storage
 *
 * Creates a simplified output format that contains the sortedTree structure
 * which has topics, subtopics, and claims in the final format.
 *
 * NOTE: This is a simplified format compared to the full PipelineOutput schema.
 * The pipeline-worker doesn't have all the data transformation logic that
 * express-server has (like building sources, hydrating claims with UUIDs, etc.)
 * so we save the sortedTree structure directly.
 */

import type { PipelineJobMessage } from "tttc-common/schema";
import * as schema from "tttc-common/schema";
import { z } from "zod";
import { PipelineFormatError, type PipelineResult } from "./types";

export interface SimplifiedPipelineOutput {
  version: "pipeline-worker-v1.0";
  reportDetails: {
    title: string;
    description: string;
    question: string;
    filename: string;
  };
  sortedTree: NonNullable<PipelineResult["outputs"]>["sortedTree"];
  analytics: {
    totalTokens: number;
    totalCost: number;
    totalDurationMs: number;
    stepAnalytics: PipelineResult["state"]["stepAnalytics"];
  };
  cruxes?: NonNullable<PipelineResult["outputs"]>["cruxes"];
  prompts: {
    systemInstructions: string;
    clusteringInstructions: string;
    extractionInstructions: string;
    dedupInstructions: string;
    summariesInstructions: string;
    cruxInstructions?: string;
    outputLanguage?: string;
  };
  completedAt: string;
}

/**
 * Zod schema for step analytics
 * Matches StepAnalytics interface from types.ts
 */
const stepAnalyticsSchema = z.object({
  stepName: z.enum([
    "clustering",
    "claims",
    "sort_and_deduplicate",
    "summaries",
    "cruxes",
  ]),
  status: z.enum(["pending", "in_progress", "completed", "failed", "skipped"]),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  durationMs: z.number().optional(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  cost: z.number().optional(),
  errorMessage: z.string().optional(),
  errorName: z.string().optional(),
});

/**
 * Zod schema for validating SimplifiedPipelineOutput
 * Used to validate reconstructed pipeline output from Redis state
 */
export const simplifiedPipelineOutputSchema = z.object({
  version: z.literal("pipeline-worker-v1.0"),
  reportDetails: z.object({
    title: z.string(),
    description: z.string(),
    question: z.string(),
    filename: z.string(),
  }),
  sortedTree: z.unknown(), // SortedTree format - validated during pipeline execution
  analytics: z.object({
    totalTokens: z.number(),
    totalCost: z.number(),
    totalDurationMs: z.number(),
    stepAnalytics: z.object({
      clustering: stepAnalyticsSchema,
      claims: stepAnalyticsSchema,
      sort_and_deduplicate: stepAnalyticsSchema,
      summaries: stepAnalyticsSchema,
      cruxes: stepAnalyticsSchema,
    }),
  }),
  cruxes: z.unknown().optional(),
  prompts: z.object({
    systemInstructions: z.string(),
    clusteringInstructions: z.string(),
    extractionInstructions: z.string(),
    dedupInstructions: z.string(),
    summariesInstructions: z.string(),
    cruxInstructions: z.string().optional(),
    outputLanguage: z.string().optional(),
  }),
  completedAt: z.string(),
});

/**
 * Convert pipeline runner result to simplified output format
 */
export function formatPipelineOutput(
  result: PipelineResult,
  jobConfig: PipelineJobMessage,
): SimplifiedPipelineOutput {
  if (!result.success || !result.outputs) {
    throw new PipelineFormatError("Cannot format output for failed pipeline");
  }

  const { instructions } = jobConfig.config;
  const { reportDetails } = jobConfig;

  return {
    version: "pipeline-worker-v1.0",
    reportDetails: {
      title: reportDetails.title,
      description: reportDetails.description,
      question: reportDetails.question,
      filename: reportDetails.filename,
    },
    sortedTree: result.outputs.sortedTree,
    analytics: {
      totalTokens: result.state.totalTokens,
      totalCost: result.state.totalCost,
      totalDurationMs: result.state.totalDurationMs,
      stepAnalytics: result.state.stepAnalytics,
    },
    cruxes: result.outputs.cruxes,
    prompts: {
      systemInstructions: instructions.systemInstructions,
      clusteringInstructions: instructions.clusteringInstructions,
      extractionInstructions: instructions.extractionInstructions,
      dedupInstructions: instructions.dedupInstructions,
      summariesInstructions: instructions.summariesInstructions,
      cruxInstructions: instructions.cruxInstructions,
      outputLanguage: instructions.outputLanguage,
    },
    completedAt: new Date().toISOString(),
  };
}
