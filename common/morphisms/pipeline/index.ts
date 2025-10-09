import * as schema from "../../schema";
// ! for some reason uuid's types aren't working?
// @ts-ignore
import { v4 } from "uuid";

// type SourcePair = [schema.SourceRow, schema.Source];

const uuid = (): string => v4();

type ClaimMap = Record<string, schema.Claim>;
type SourceMap = Record<string, schema.Source>;

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
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
 * If the data is missing an interview attribution, assign a anonymous name.
 *
 * This function takes the source rows, sees if the pattern 'Anonymous #n' is used. Start from the last number.
 */
const makeAnonymousInterview = (sourceRows: schema.SourceRow[]) => {
  const usedAnonNums: number[] = sourceRows
    .map((r) => r.interview && r.interview.match(/Anonymous #(\d+)/))
    .map((expArr) => (expArr ? parseInt(expArr[1]) : null))
    .filter((val): val is number => val !== null)
    .map(Math.abs);

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
const buildSourceMap = (sourceRows: schema.SourceRow[]) => {
  const genAnon = makeAnonymousInterview(sourceRows);
  return sourceRows.reduce((accum, curr) => {
    accum[curr.id!] = {
      id: uuid(),
      interview: curr.interview || genAnon(),
      data: curr.video
        ? [
            "video",
            {
              text: curr.comment!,
              link: curr.video,
              timestamp: curr.timestamp!,
            },
          ]
        : [
            "text",
            {
              text: curr.comment!,
            },
          ],
    };
    return accum;
  }, {} as SourceMap);
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

const buildClaimsMap = (
  pipeline: schema.LLMPipelineOutput,
  sourceMap: SourceMap,
) => {
  const allClaims = sortTax(pipeline.tree).flatMap((topic) =>
    topic.subtopics.flatMap((subtopic) => {
      // Ensure subtopic.claims is an array
      if (!subtopic.claims) return [];

      // Handle the possibility of undefined values in duplicates
      const duplicates = subtopic.claims.flatMap((claim) =>
        claim.duplicates ? claim.duplicates : [],
      );

      return subtopic.claims.concat(duplicates);
    }),
  );
  const createClaim = numberClaims();

  return allClaims.reduce((accum, curr) => {
    accum[curr.claimId!] = createClaim(curr, sourceMap, accum);

    // Updated handling of duplicates
    curr.duplicates?.forEach((dup, i) => {
      if (dup.claimId && curr.claimId) {
        accum[dup.claimId] = accum[curr.claimId]?.similarClaims[i];
      }
    });

    return accum;
  }, {} as ClaimMap);
};

const makeReference = (
  source: schema.Source,
  claim: schema.LLMClaim,
): schema.Referece => {
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

const getSubtopicsFromLLMSubTopics =
  (claimMap: ClaimMap) =>
  (subtopics: schema.LLMSubtopic[]): schema.Subtopic[] =>
    subtopics
      .map((subtopic) => ({
        id: uuid(),
        title: subtopic.subtopicName,
        description: subtopic.subtopicShortDescription!,
        claims: subtopic.claims
          ? subtopic.claims.map((claim) => claimMap[claim.claimId!])
          : [],
      }))
      .filter(
        (subtopic) =>
          Array.isArray(subtopic.claims) && subtopic.claims.length > 0,
      );

const getTopicsFromTaxonomy =
  (claimMap: ClaimMap) =>
  (tree: schema.Taxonomy): schema.Topic[] =>
    tree
      .map((leaf, idx) => ({
        id: uuid(),
        title: leaf.topicName,
        description: leaf.topicShortDescription!,
        summary: leaf.topicSummary,
        subtopics: getSubtopicsFromLLMSubTopics(claimMap)(leaf.subtopics),
        topicColor: colorPicker(idx),
      }))
      .filter((topic) => topic.subtopics.length > 0);

export const getReportDataObj = (
  pipelineOutput: schema.LLMPipelineOutput,
): schema.ReportDataObj => {
  const sourceMap = buildSourceMap(pipelineOutput.data);
  const claimMap = buildClaimsMap(pipelineOutput, sourceMap);
  return schema.reportDataObj.parse({
    title: pipelineOutput.title,
    description: pipelineOutput.description,
    date: new Date().toISOString(),
    topics: getTopicsFromTaxonomy(claimMap)(pipelineOutput.tree),
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
  pipelineOuput: schema.LLMPipelineOutput,
): schema.PipelineOutput => ({
  data: ["v0.2", getReportDataObj(pipelineOuput)],
  metadata: ["v0.2", getReportMetaData(pipelineOuput)],
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
  getTopicsFromTaxonomy,
  llmClaimToSchemaClaim,
  numberClaims,
  // pairSourcesWithRows,
};
