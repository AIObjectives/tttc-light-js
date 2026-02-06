/**
 * Format pipeline runner output for storage
 *
 * Converts the internal sortedTree format to the LLMPipelineOutput format
 * that express-server expects. This allows express-server to use its existing
 * transformation logic in common/transforms/pipeline to convert to the final
 * schema format.
 */

import type * as schema from "tttc-common/schema";
import type { PipelineJobMessage } from "tttc-common/schema";
import type { DedupedClaim } from "../pipeline-steps/types";
import { PipelineFormatError, type PipelineResult } from "./types";

/**
 * Convert sortedTree format to LLMPipelineOutput format
 * Transforms the pipeline-worker's internal structure to match what express-server expects
 */
export function formatPipelineOutput(
  result: PipelineResult,
  jobConfig: PipelineJobMessage,
): schema.LLMPipelineOutput {
  if (!result.success || !result.outputs) {
    throw new PipelineFormatError("Cannot format output for failed pipeline");
  }

  const { instructions } = jobConfig.config;
  const { reportDetails } = jobConfig;
  const { sortedTree, summaries, cruxes } = result.outputs;

  // Convert sortedTree to taxonomy (LLMTopic[])
  const taxonomy: schema.LLMTopic[] = sortedTree.map(
    ([topicName, topicData]) => {
      // Find the summary for this topic
      const topicSummary = summaries?.find((s) => s.topicName === topicName);

      // Convert subtopics
      const subtopics: schema.LLMSubtopic[] = topicData.topics.map(
        ([subtopicName, subtopicData]) => {
          // Convert claims to LLMClaim format
          const claims: schema.LLMClaim[] = subtopicData.claims.map((claim) =>
            convertDedupedClaimToLLMClaim(claim),
          );

          return {
            subtopicName,
            subtopicShortDescription: subtopicName, // Use subtopic name as default description
            subtopicId: undefined, // IDs are generated later by transforms
            claimsCount: claims.length,
            claims,
          };
        },
      );

      return {
        topicName,
        topicSummary: topicSummary?.summary,
        topicShortDescription: topicName, // Use topic name as default description
        topicId: undefined, // IDs are generated later by transforms
        claimsCount: topicData.counts.claims,
        subtopics,
      };
    },
  );

  // Convert source data to SourceRow format
  const data: schema.SourceRow[] = jobConfig.data.map(
    (row: schema.SourceRow) => ({
      id: row.id,
      comment: row.comment,
      interview: row.interview,
      video: row.video,
      timestamp: row.timestamp,
    }),
  );

  // Build the LLMPipelineOutput
  const output: schema.LLMPipelineOutput = {
    data,
    title: reportDetails.title,
    question: reportDetails.question,
    description: reportDetails.description,
    systemInstructions: instructions.systemInstructions,
    clusteringInstructions: instructions.clusteringInstructions,
    extractionInstructions: instructions.extractionInstructions,
    dedupInstructions: instructions.dedupInstructions,
    summariesInstructions: instructions.summariesInstructions,
    cruxInstructions: instructions.cruxInstructions,
    outputLanguage: instructions.outputLanguage,
    batchSize: 50, // Default batch size
    tree: taxonomy,
    start: Date.now() - result.state.totalDurationMs,
    costs: result.state.totalCost,
    end: Date.now(),
    duration: `${result.state.totalDurationMs}ms`,
    addOns: cruxes
      ? {
          subtopicCruxes: cruxes.subtopicCruxes,
          topicScores: cruxes.topicScores,
          speakerCruxMatrix: {
            speakers: cruxes.speakerCruxMatrix.speakers,
            cruxLabels: cruxes.speakerCruxMatrix.cruxLabels,
            matrix: cruxes.speakerCruxMatrix
              .matrix as schema.SpeakerCruxPosition[][],
          },
        }
      : undefined,
  };

  return output;
}

/**
 * Convert DedupedClaim to LLMClaim format recursively
 * Note: DedupedClaim doesn't have claimId field - IDs are array indices
 */
function convertDedupedClaimToLLMClaim(claim: DedupedClaim): schema.LLMClaim {
  const llmClaim: schema.LLMClaim = {
    claim: claim.claim,
    quote: claim.quote,
    claimId: undefined, // No claim IDs in pipeline-worker format
    topicName: claim.topicName,
    subtopicName: claim.subtopicName,
    commentId: claim.commentId,
    duplicated: claim.duplicated,
  };

  // Recursively convert duplicates
  if (claim.duplicates && claim.duplicates.length > 0) {
    llmClaim.duplicates = claim.duplicates.map(convertDedupedClaimToLLMClaim);
  }

  return llmClaim;
}
