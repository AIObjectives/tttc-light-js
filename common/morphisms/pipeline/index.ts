import { v4 } from "uuid";
import * as schema from "../../schema";

// type SourcePair = [schema.SourceRow, schema.Source];

const uuid = (): string => v4();

type ClaimMap = Record<string, schema.Claim>;
type SourceMap = Record<string, schema.Source>;

function mulberry32(a: number) {
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pseudoRand = mulberry32(42);

const colorArr = schema.topicColors.options
  .map((color) => ({ color, sort: pseudoRand() }))
  .sort((a, b) => b.sort - a.sort)
  .map((val) => val.color);

const colorPicker = (idx: number) => colorArr[idx % colorArr.length];

/**
 * Extracts the anonymous number from an interview string if it matches "Anonymous #N" pattern.
 * Returns the number if valid and positive, otherwise null.
 */
function extractAnonymousNumber(interview: string | undefined): number | null {
  if (!interview) return null;
  const match = interview.match(/Anonymous #(\d+)/);
  if (!match?.[1]) return null;
  const num = parseInt(match[1], 10);
  return !Number.isNaN(num) && num > 0 ? num : null;
}

/**
 * If the data is missing an interview attribution, assign an anonymous name.
 *
 * This function takes the source rows, sees if the pattern 'Anonymous #n' is used. Start from the last number.
 */
const makeAnonymousInterview = (sourceRows: schema.SourceRow[]) => {
  const usedAnonNums: number[] = [];

  for (const row of sourceRows) {
    const num = extractAnonymousNumber(row.interview);
    if (num !== null) usedAnonNums.push(num);
  }

  const maxNum = usedAnonNums.length > 0 ? Math.max(...usedAnonNums) : 0;

  let i = maxNum;
  return () => {
    i++;
    return `Anonymous #${i}`;
  };
};

/**
 * Takes source rows and builds a map from row id -> Source
 */
const buildSourceMap = (sourceRows: schema.SourceRow[]): SourceMap => {
  const genAnon = makeAnonymousInterview(sourceRows);
  const sourceMap: SourceMap = {};

  for (const row of sourceRows) {
    sourceMap[row.id] = {
      id: uuid(),
      interview: row.interview || genAnon(),
      data: row.video
        ? [
            "video",
            {
              text: row.comment,
              link: row.video,
              // timestamp is optional in schema but required for video entries
              // biome-ignore lint/style/noNonNullAssertion: video entries always have timestamp
              timestamp: row.timestamp!,
            },
          ]
        : [
            "text",
            {
              text: row.comment,
            },
          ],
    };
  }

  return sourceMap;
};

const llmClaimToSchemaClaim = (
  llmClaim: schema.LLMClaim,
  sourceMap: SourceMap,
  number: number,
): schema.Claim => ({
  id: uuid(),
  title: llmClaim.claim,
  quotes: [getQuote(llmClaim, sourceMap)],
  number,
  similarClaims: llmClaim.duplicates
    ? llmClaim.duplicates.map((clm) => llmClaimToSchemaClaim(clm, sourceMap, 0))
    : [],
});

const numberClaims = () => {
  let i = 0;
  const alreadyNumberedIds = new Set<string>();
  const x = (
    clm: schema.LLMClaim,
    sourceMap: SourceMap,
    claimMap: ClaimMap,
  ): schema.Claim => {
    if (clm.claimId && alreadyNumberedIds.has(clm.claimId)) {
      return claimMap[clm.claimId];
    }
    if (clm.claimId) {
      alreadyNumberedIds.add(clm.claimId);
    }
    i++;
    return {
      id: uuid(),
      title: clm.claim,
      quotes: [getQuote(clm, sourceMap)],
      number: i,
      similarClaims: clm.duplicates
        ? clm.duplicates.map((clm) => x(clm, sourceMap, claimMap))
        : [],
    };
  };
  return x;
};

const topicNumClaims = (topic: schema.LLMTopic): number =>
  topic.subtopics.flatMap((s) => s.claims ?? []).length;

const subtopicNumClaims = (subtopic: schema.LLMSubtopic): number =>
  subtopic.claims?.length ?? 0;

const sortTax = (tax: schema.Taxonomy) =>
  tax.sort((t1, t2) => {
    const tax1: schema.LLMTopic = {
      ...t1,
      subtopics: t1.subtopics.sort(
        (s1, s2) => subtopicNumClaims(s2) - subtopicNumClaims(s1),
      ),
    };
    const tax2: schema.LLMTopic = {
      ...t2,
      subtopics: t2.subtopics.sort(
        (s1, s2) => subtopicNumClaims(s2) - subtopicNumClaims(s1),
      ),
    };

    return topicNumClaims(tax2) - topicNumClaims(tax1);
  });

/**
 * Collects a claim and its duplicates into a flat array.
 * Extracted for debuggability - set breakpoints here to inspect individual claim collection.
 */
function collectClaimWithDuplicates(claim: schema.LLMClaim): schema.LLMClaim[] {
  const result = [claim];
  const duplicates = claim.duplicates ?? [];
  for (const dup of duplicates) {
    result.push(dup);
  }
  return result;
}

/**
 * Collects all claims from a single subtopic including duplicates.
 * Extracted for debuggability - set breakpoints here to inspect subtopic claim collection.
 */
function collectSubtopicClaims(
  subtopic: schema.LLMSubtopic,
): schema.LLMClaim[] {
  if (!subtopic.claims) return [];
  const result: schema.LLMClaim[] = [];
  for (const claim of subtopic.claims) {
    result.push(...collectClaimWithDuplicates(claim));
  }
  return result;
}

/**
 * Collects all claims (including duplicates) from a sorted taxonomy tree.
 * Extracted for debuggability - set breakpoints here to inspect claim collection.
 */
function collectAllClaims(sortedTree: schema.Taxonomy): schema.LLMClaim[] {
  const allClaims: schema.LLMClaim[] = [];

  for (const topic of sortedTree) {
    for (const subtopic of topic.subtopics) {
      allClaims.push(...collectSubtopicClaims(subtopic));
    }
  }

  return allClaims;
}

/**
 * Links duplicate claims to their parent's similarClaims array in the claim map.
 * Extracted for debuggability - set breakpoints here to inspect duplicate linking.
 */
function linkDuplicateClaims(claim: schema.LLMClaim, claimMap: ClaimMap): void {
  const duplicates = claim.duplicates ?? [];
  for (let i = 0; i < duplicates.length; i++) {
    const dup = duplicates[i];
    if (dup.claimId && claim.claimId) {
      claimMap[dup.claimId] = claimMap[claim.claimId]?.similarClaims[i];
    }
  }
}

const buildClaimsMap = (
  pipeline: schema.LLMPipelineOutput,
  sourceMap: SourceMap,
): ClaimMap => {
  const claimMap: ClaimMap = {};
  const createClaim = numberClaims();
  const sortedTree = sortTax(pipeline.tree);
  const allClaims = collectAllClaims(sortedTree);

  for (const claim of allClaims) {
    // biome-ignore lint/style/noNonNullAssertion: claimId is required at this stage
    claimMap[claim.claimId!] = createClaim(claim, sourceMap, claimMap);
    linkDuplicateClaims(claim, claimMap);
  }

  return claimMap;
};

const makeReference = (
  source: schema.Source,
  claim: schema.LLMClaim,
): schema.Reference => {
  if (source.data[0] === "video" && source.data[1].timestamp === undefined) {
    console.log("HERE", source);
  }
  switch (source.data[0]) {
    case "text":
      return {
        id: uuid(),
        sourceId: source.id,
        interview: source.interview,
        data: [
          "text",
          {
            startIdx: getReferenceStartIndex(claim, source.data[1].text),
            endIdx: getReferenceEndIndex(claim, source.data[1].text),
          },
        ],
      };
    case "video":
      return {
        id: uuid(),
        sourceId: source.id,
        interview: source.interview,
        data: [
          "video",
          {
            link: source.data[1].link,
            beginTimestamp: source.data[1].timestamp,
            endTimestamp: undefined,
          },
        ],
      };
    case "audio": {
      throw new Error("Audio reference not implemented yet");
    }
    default: {
      throw new Error("Invalid source in pipeline - makeReference");
    }
  }
};

const getQuote = (
  claim: schema.LLMClaim,
  sourceMap: SourceMap,
): schema.Quote => ({
  id: uuid(),
  text: claim.quote,
  reference: makeReference(sourceMap[claim.commentId!], claim),
});

const getReferenceStartIndex = (clm: schema.LLMClaim, fullText: string) =>
  fullText.indexOf(clm.quote);

const getReferenceEndIndex = (clm: schema.LLMClaim, fullText: string) =>
  getReferenceStartIndex(clm, fullText) + clm.quote.length;

function buildSubtopics(
  subtopics: schema.LLMSubtopic[],
  claimMap: ClaimMap,
): schema.Subtopic[] {
  const result: schema.Subtopic[] = [];

  for (const subtopic of subtopics) {
    const claims = subtopic.claims
      ? // biome-ignore lint/style/noNonNullAssertion: claimId required at this stage
        subtopic.claims.map((claim) => claimMap[claim.claimId!])
      : [];

    // Only include subtopics that have claims
    if (claims.length > 0) {
      result.push({
        id: uuid(),
        title: subtopic.subtopicName,
        // biome-ignore lint/style/noNonNullAssertion: description required at this stage
        description: subtopic.subtopicShortDescription!,
        claims,
      });
    }
  }

  return result;
}

function buildTopics(
  tree: schema.Taxonomy,
  claimMap: ClaimMap,
): schema.Topic[] {
  const result: schema.Topic[] = [];

  for (let idx = 0; idx < tree.length; idx++) {
    const leaf = tree[idx];
    const subtopics = buildSubtopics(leaf.subtopics, claimMap);

    // Only include topics that have subtopics
    if (subtopics.length > 0) {
      result.push({
        id: uuid(),
        title: leaf.topicName,
        // biome-ignore lint/style/noNonNullAssertion: description required at this stage
        description: leaf.topicShortDescription!,
        summary: leaf.topicSummary,
        subtopics,
        topicColor: colorPicker(idx),
      });
    }
  }

  return result;
}

export const getReportDataObj = (
  pipelineOutput: schema.LLMPipelineOutput,
): schema.ReportDataObj => {
  const sourceMap = buildSourceMap(pipelineOutput.data);
  const claimMap = buildClaimsMap(pipelineOutput, sourceMap);
  return schema.reportDataObj.parse({
    title: pipelineOutput.title,
    description: pipelineOutput.description,
    date: new Date().toISOString(),
    topics: buildTopics(pipelineOutput.tree, claimMap),
    sources: pipelineOutput.data.map((row) => sourceMap[row.id]),
    //TODO: pretty sure we need this
    addOns: pipelineOutput.addOns,
  });
};

// TODO leaving this out because it hasn't been implemented yet.
// const buildStageData: schema.PipelineStepData = {
//   temperature: 0,
//   batchSize: 0,
//   tokenCount: {
//     sent: 0,
//     received: 0,
//     total: 0,
//   },
//   costPerToken: {
//     denomination: "$",
//     value: 0,
//   },
//   model: "claude-instant-v1",
//   instructions: "",
// };

const getReportMetaData = (
  pipelineOutput: schema.LLMPipelineOutput,
): schema.ReportMetadataObj => ({
  duration: 0, // Note: This is a string in llm pipeline output. Figure out way to translate
  // buildProcess: schema.pipelineStages.options.map((stage) => [
  //   stage,
  //   buildStageData,
  // ]),
  startTimestamp: pipelineOutput.start,
  totalCost: "",
  author: "",
  organization: "",
});

export const llmPipelineToSchema = (
  pipelineOutput: schema.LLMPipelineOutput,
): schema.PipelineOutput => ({
  data: ["v0.2", getReportDataObj(pipelineOutput)],
  metadata: ["v0.2", getReportMetaData(pipelineOutput)],
});

export const _internal = {
  buildSourceMap,
  buildClaimsMap,
  getReferenceEndIndex,
  getReferenceStartIndex,
  getReportDataObj,
  getReportMetaData,
  getQuote,
  // getSources,
  buildTopics,
  llmClaimToSchemaClaim,
  numberClaims,
  // pairSourcesWithRows,
};
