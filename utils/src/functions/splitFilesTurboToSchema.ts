import * as schema from "tttc-common/schema";
import { v4 } from "uuid";
import { llmPipelineToSchema } from "tttc-common/morphisms/pipeline";
import {
  TurboClaim,
  TurboClaimArg,
  TurboClaimMap,
  TurboSourceRow,
  TurboTopicClustering,
} from "../schema/turboData";

/**
 * @fileoverview
 * Translates data from the turbo schema to the new schema
 */

const makeId = (): string => v4();

const translateSourceRow = (turbo: TurboSourceRow): schema.SourceRow => ({
  ...turbo,
  id: turbo["comment-id"],
  comment: turbo["comment-body"],
});

const translateClaim = (
  id: string,
  commentId: string,
  turbo: TurboClaim,
): schema.LLMClaim => ({
  claimId: id,
  quote: turbo.quote,
  claim: turbo.claim,
  topicName: turbo.topicName,
  subtopicName: turbo.subtopicName,
  commentId: commentId,
});

const makeTree = (
  claimMap: TurboClaimMap,
  topicClustering: TurboTopicClustering,
) => {
  const claimEntries: [string, TurboClaimArg][] = Object.keys(claimMap).map(
    (key) => [key, claimMap[key]],
  );

  const translatedClaims = claimEntries.flatMap(
    ([commentId, claimArg]: [string, TurboClaimArg]) =>
      claimArg.claims.map((c) => translateClaim(makeId(), commentId, c)),
  );

  const mapClaimsToTopicName: Record<string, schema.LLMClaim[]> =
    translatedClaims.reduce(
      (accum, claim) => {
        accum[claim.topicName] = [...(accum[claim.topicName] || []), claim];
        return accum;
      },
      {} as Record<string, schema.LLMClaim[]>,
    );

  const mapClaimsToSubTopicName: Record<string, schema.LLMClaim[]> =
    translatedClaims.reduce(
      (accum, claim) => {
        accum[claim.subtopicName!] = [
          ...(accum[claim.subtopicName!] || []),
          claim,
        ];
        return accum;
      },
      {} as Record<string, schema.LLMClaim[]>,
    );

  const safeGetFromRecord = <K>(rec: Record<string, K>, query: string): K => {
    const result = rec[query];
    if (result === undefined) throw new Error(`Value not in record - ${query}`);
    return result;
  };

  const tree: schema.Taxonomy = topicClustering.topics.map((turboTopic) => ({
    topicId: makeId(),
    topicName: turboTopic.topicName,
    topicShortDescription: turboTopic.topicShortDescription,
    claimsCount: safeGetFromRecord(mapClaimsToTopicName, turboTopic.topicName)
      .length,
    subtopics: turboTopic.subtopics.map((subtopic) => ({
      subtopicId: makeId(),
      subtopicName: subtopic.subtopicName,
      subtopicShortDescription: subtopic.subtopicShortDescription,
      claimsCount: safeGetFromRecord(
        mapClaimsToSubTopicName,
        subtopic.subtopicName,
      ).length,
      claims: safeGetFromRecord(mapClaimsToSubTopicName, subtopic.subtopicName),
    })) as schema.LLMSubtopic[],
  }));
  return schema.taxonomy.parse(tree);
};

interface ReportDetails {
  title: string;
  question: string;
  description: string;
}

const makeLLMPipelineOutput = (
  turboRows: TurboSourceRow[],
  claimMap: TurboClaimMap,
  topicClustering: TurboTopicClustering,
  reportDetails: ReportDetails,
): schema.LLMPipelineOutput => {
  const data = turboRows.map(translateSourceRow);
  const tree = makeTree(claimMap, topicClustering);

  return schema.llmPipelineOutput.parse({
    data,
    tree,
    systemInstructions: "",
    clusteringInstructions: "",
    extractionInstructions: "",
    batchSize: 0,
    start: 0,
    costs: 0,
    ...reportDetails,
  });
};

export const splitFileTurboToSchema = (
  turboRows: TurboSourceRow[],
  claimMap: TurboClaimMap,
  topicClustering: TurboTopicClustering,
  reportDetails: ReportDetails,
) => {
  const llmoutput = makeLLMPipelineOutput(
    turboRows,
    claimMap,
    topicClustering,
    reportDetails,
  );
  return llmPipelineToSchema(llmoutput);
};
