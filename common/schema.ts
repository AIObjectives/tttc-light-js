// import { getNClaims } from "./morphisms";
import { z } from "zod";

/** VVVVVVVVVVVVVVVVVVVVVVVVVVVVV */
/********************************
 * CSV TYPES
 ********************************/
/** ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ */

/**
 * Source Row
 * What the parsed CSV files should look like
 */
export const sourceRow = z.object({
  comment: z.string(),
  id: z.string(),
  interview: z.string().optional(),
  video: z.string().optional(),
  timestamp: z.string().optional(),
});

const csvDataPayload = z.tuple([z.literal("csv"), sourceRow.array()]);

/**
 * Google Sheet Data
 * What input from a google sheet should look like
 */
const googleSheetData = z.object({
  url: z.string(),
  pieChartColumns: z.string().array().optional(),
  filterEmails: z.string().array().optional(),
  oneSubmissionPerEmail: z.boolean(),
});

export type GoogleSheetData = z.infer<typeof googleSheetData>;

const googleSheetDataPayload = z.tuple([
  z.literal("googlesheet"),
  googleSheetData,
]);

/**
 * Data Payload
 * Union of CSV and Google Sheet inputs
 */
export const dataPayload = z.union([csvDataPayload, googleSheetDataPayload]);

export type DataPayload = z.infer<typeof dataPayload>;

export type SourceRow = z.infer<typeof sourceRow>;

/** VVVVVVVVVVVVVVVVVVVVVVVVVVVVV */
/********************************
 * LLM TYPES
 ********************************/
/** ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ */

export const llmPieChart = z.object({
  title: z.string(),
  items: z.object({ label: z.string(), count: z.number() }).array(),
});

export type LLMPieChart = z.infer<typeof llmPieChart>;

export const llmUserConfig = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  systemInstructions: z.string().min(1),
  clusteringInstructions: z.string().min(1),
  extractionInstructions: z.string().min(1),
  dedupInstructions: z.string().min(1),
  cruxInstructions: z.string().optional(),
});

export type LLMUserConfig = z.infer<typeof llmUserConfig>;

export const llmSystemConfig = z.object({
  model: z.string().optional(),
  batchSize: z.number(),
  filename: z.string(),
});

export type oldSystemConfig = z.infer<typeof llmSystemConfig>;

export const oldOptions = z.object({
  model: z.string(),
  data: sourceRow.array(),
  title: z.string(),
  question: z.string(),
  pieCharts: llmPieChart.array().optional(),
  description: z.string(),
  systemInstructions: z.string(),
  clusteringInstructions: z.string(),
  extractionInstructions: z.string(),
  dedupInstructions: z.string(),
  cruxInstructions: z.string().optional(),
  batchSize: z.number(),
  filename: z.string(),
  googleSheet: z
    .object({
      url: z.string(),
      pieChartColumns: z.string().array().optional(),
      filterEmails: z.string().array().optional(),
      oneSubmissionPerEmail: z.boolean(),
    })
    .optional(),
});

export type OldOptions = z.infer<typeof oldOptions>;

// Zod has trouble with self-referential types, so leave this be until we need to parse
type _LLMClaim = {
  claim: string;
  quote: string;
  claimId?: string;
  topicName: string;
  subtopicName?: string;
  commentId?: string;
  duplicates?: LLMClaim[];
  duplicated?: boolean;
};

const oldclaim = z.custom<_LLMClaim>();

export type LLMClaim = z.infer<typeof oldclaim>;

export const cache = z.object({
  get: z.function().args(z.string()).returns(z.any()),
  set: z.function().args(z.string(), z.any()).returns(z.void()),
});

export type Cache = z.infer<typeof cache>;

export const tracker = z.object({
  start: z.number(),
  costs: z.number(),
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
  unmatchedClaims: z.array(oldclaim),
  end: z.number().optional(),
  duration: z.string().optional(),
});

export type Tracker = z.infer<typeof tracker>;

export const usageTokens = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
});
export type UsageTokens = z.infer<typeof usageTokens>;

export const llmSubtopic = z.object({
  subtopicName: z.string(),
  subtopicShortDescription: z.string().optional(),
  subtopicId: z.string().optional(),
  claimsCount: z.number().optional(),
  claims: z.array(oldclaim).optional(),
});

export type LLMSubtopic = z.infer<typeof llmSubtopic>;

export const llmTopic = z.object({
  topicName: z.string(),
  topicShortDescription: z.string().optional(),
  topicId: z.string().optional(),
  claimsCount: z.number().optional(),
  subtopics: z.array(llmSubtopic),
});

export type LLMTopic = z.infer<typeof llmTopic>;

export const taxonomy = z.array(llmTopic);

export type Taxonomy = z.infer<typeof taxonomy>;

/********************************
 * Addons
 * Extra data that can be attached for special features
 ********************************/

export const crux = z.object({
  score: z.number(),
  cruxA: z.string(),
  cruxB: z.string(),
});

export type Crux = z.infer<typeof crux>;

const controversyMatrix = z.array(z.number()).array();

export type ControversyMatrix = z.infer<typeof controversyMatrix>;

export const cruxClaim = z.object({
  cruxClaim: z.string(),
  agree: z.array(z.string()),
  disagree: z.array(z.string()),
  explanation: z.string(),
});

export type CruxClaim = z.infer<typeof cruxClaim>;

export const addOns = z.object({
  topCruxes: crux.array().optional(),
  controversyMatrix: controversyMatrix.optional(),
  cruxClaims: cruxClaim.array().optional(),
});

export type AddOns = z.infer<typeof addOns>;

export const llmPipelineOutput = z.object({
  data: z.array(sourceRow),
  title: z.string(),
  question: z.string(),
  pieChart: z.array(llmPieChart).optional(),
  description: z.string(),
  systemInstructions: z.string(),
  clusteringInstructions: z.string(),
  extractionInstructions: z.string(),
  batchSize: z.number(),
  tree: taxonomy,
  start: z.number(),
  costs: z.number(),
  end: z.number().optional(),
  duration: z.string().optional(),
  addOns: addOns.optional(),
});

export type LLMPipelineOutput = z.infer<typeof llmPipelineOutput>;

export const llmSourceMap = z.record(z.string(), sourceRow);

export type LLMSourceMap = z.infer<typeof llmSourceMap>;

/** VVVVVVVVVVVVVVVVVVVVVVVVVVVVV */
/********************************
 * UI FACING SCHEMA TYPES
 ********************************/
/** ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ */

/********************************
 * Sources
 * Sources are the material being referrenced, e.g. a video or interview.
 * There exists a one-to-many relationship between sources and referrences.
 ********************************/

export const textMediaSource = z.tuple([
  z.literal("text"),
  z.object({
    text: z.string(),
  }),
]);

export type TextMediaSource = z.infer<typeof textMediaSource>;

const videoMediaSource = z.tuple([
  z.literal("video"),
  z.object({
    text: z.string(),
    link: z.string(),
    timestamp: z.string().default("0:00:00"),
  }),
]);

const audioMediaSource = z.tuple([
  z.literal("audio"),
  z.object({
    link: z.string(),
  }),
]);

// Maybe author or metadata ??

const mediaSources = z.union([
  textMediaSource,
  videoMediaSource,
  audioMediaSource,
]);

export const source = z.object({
  id: z.string(),
  interview: z.string().default("Anonymous"),
  data: mediaSources,
});

export type Source = z.infer<typeof source>;

/********************************
 * References
 * Maybe call it excerpts?
 * References should point at where in the source is being used.
 ********************************/

const referenceText = z.tuple([
  z.literal("text"),
  z.object({
    startIdx: z.number(),
    endIdx: z.number(),
  }),
]);

export type ReferenceText = z.infer<typeof referenceText>;

const referenceVideo = z.tuple([
  z.literal("video"),
  z.object({
    link: z.string(),
    beginTimestamp: z.string(),
    endTimestamp: z.string().optional(),
  }),
]);

export type ReferenceVideo = z.infer<typeof referenceVideo>;

const referenceAudio = z.tuple([
  z.literal("audio"),
  z.object({
    beginTimestamp: z.string(),
    endTimestamp: z.string().optional(),
  }),
]);

export const reference = z.object({
  id: z.string(),
  sourceId: z.string(),
  interview: z.string().default("Anonymous"),
  data: z.union([referenceText, referenceVideo, referenceAudio]),
});

export type Referece = z.infer<typeof reference>;

/********************************
 * Quote
 * Quotes are objects used in the Report to show the user what was specifically said
 ********************************/
export const quote = z.object({
  id: z.string(),
  text: z.string(),
  reference: reference,
});

export type Quote = z.infer<typeof quote>;

/********************************
 * Claim
 * Claims are specific points made that are derived from the source material
 * They also contain an array of similarly made claims
 ********************************/
// Zod has trouble with self-referential types, so leave this be until we need to parse
export type Claim = {
  id: string;
  title: string;
  quotes: Quote[];
  similarClaims: Claim[];
  number: number;
};

export const claim = z.custom<Claim>();

/********************************
 * Subtopic
 * Subtopic are categories of claims that share some relation.
 ********************************/
export const subtopic = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  claims: z.array(claim),
});

export type Subtopic = z.infer<typeof subtopic>;

/**
 * This is the list of colors that we use at the moment, but don't make this hard coded into the schema so we can change colors if necessary.
 */
export const topicColors = z.enum([
  "violet",
  "blueSea",
  "blueSky",
  "greenLeaf",
  "greenLime",
  "yellow",
  "red",
  "purple",
  "brown",
]);

export type TopicColors = z.infer<typeof topicColors>;

/********************************
 * Topic
 * Topics are broader categories of topics
 ********************************/
export const topic = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  context: z.string().optional(),
  subtopics: z.array(subtopic),
  topicColor: z.string(),
});

export type Topic = z.infer<typeof topic>;
/********************************
 * Graphics
 * Graphics are object level representations of graphics that are added to the report
 * TODO Make note about cell graphic things not being this
 ********************************/

const pieChartGraphic = z.tuple([
  z.literal("piechart"),
  z.object({
    title: z.string(),
    items: z.object({ label: z.string(), count: z.number() }).array(),
  }),
]);

const graphics = pieChartGraphic; // make this a union when we have more

/********************************
 * Question and Answer
 * Included in the Report summary, gives the creator an opportunity to answer questions about getting data, etc
 ********************************/

export const questionAnswer = z.object({
  question: z.string(),
  answer: z.string(),
});

export type QuestionAnswer = z.infer<typeof questionAnswer>;

/********************************
 * Report Data
 * Contains all the information that a report needs to display
 ********************************/

export const reportDataObj = z.object({
  title: z.string(),
  description: z.string(),
  questionAnswers: z.optional(questionAnswer.array()),
  addOns: addOns.optional(),
  topics: z.array(topic).transform((topics) =>
    topics.sort((a, b) => {
      const setSpeakersA = new Set(
        a.subtopics.flatMap((sub) =>
          sub.claims.flatMap((c) =>
            c.quotes.flatMap((q) => q.reference.interview),
          ),
        ),
      );
      const setSpeakersB = new Set(
        new Set(
          b.subtopics.flatMap((sub) =>
            sub.claims.flatMap((c) =>
              c.quotes.flatMap((q) => q.reference.interview),
            ),
          ),
        ),
      );
      return setSpeakersB.size - setSpeakersA.size;
      // leave this here for now until we start handling sorting by both.
      // const claimsA = a.subtopics.flatMap((sub) => sub.claims);
      // const claimsB = b.subtopics.flatMap((sub) => sub.claims);
      // return claimsB.length - claimsA.length;
    }),
  ),
  sources: z.array(source),
  graphics: graphics.optional(),
  date: z.string(),
});

export type ReportDataObj = z.infer<typeof reportDataObj>;

/********************************
 * Report Versions
 * Report schemas are versioned in case future reports need to include breaking changes
 ********************************/

const v0_2_Report = z.tuple([z.literal("v0.2"), reportDataObj]);

const reportData = v0_2_Report; // make union when we have more versions

/********************************
 * Report Metadata
 * Contains information not revealed in the report
 * This information can be useful for things like running experiments and tracking costs
 ********************************/

// template + optional text
export const openAIModels = z.enum([
  "gpt-4",
  "gpt-4-32k",
  "gpt-3.5-turbo",
  "gpt-3.5-turbo-16k",
  "gpt-4-turbo-preview",
  "code-davinci-002",
  "code-cushman-001",
  "text-embedding-ada-002",
  "text-davinci-003",
  "text-curie-001",
  "text-babbage-001",
  "text-ada-001",
]);

const anthropicModels = z.enum([
  "claude-v1",
  "claude-v1-100k",
  "claude-instant-v1",
  "claude-instant-v1-100k",
  "claude-v1.2",
  "claude-v1.2-100k",
  "claude-v1.3",
  "claude-v1.3-100k",
  "claude-v1.3.1",
  "claude-v1.3.1-100k",
  "claude-v1.4",
  "claude-v1.4-100k",
]);

const models = z.union([openAIModels, anthropicModels]);

export const pipelineStages = z.enum([
  "systemInstructions",
  "clusteringInstructions",
  "extractionInstructions",
  "dedupInstructions",
]);

const tokenCount = z.object({
  sent: z.number(),
  received: z.number(),
  total: z.number(),
});

const cost = z.object({
  denomination: z.union([z.literal("$"), z.literal("£"), z.literal("€")]), // add any more we need here
  value: z.number(),
});

export const pipelineStepData = z.object({
  temperature: z.number(),
  tokenCount,
  costPerToken: cost,
  model: models,
  batchSize: z.number(),
  instructions: z.string(),
});

export type PipelineStepData = z.infer<typeof pipelineStepData>;

export const pipelineStep = z.tuple([pipelineStages, pipelineStepData]);

export type PipelineStep = z.infer<typeof pipelineStep>;

export const reportMetadataObj = z.object({
  // buildProcess: z.array(pipelineStep),
  startTimestamp: z.number(),
  duration: z.number(),
  totalCost: z.string(),
  author: z.string(),
  organization: z.string().optional(),
});

export type ReportMetadataObj = z.infer<typeof reportMetadataObj>;

/********************************
 * Pipeline Versions
 * Pipeline is versioned in case of breaking changes
 ********************************/

const v0_2_ReportMetadata = z.tuple([z.literal("v0.2"), reportMetadataObj]);

const reportMetadata = v0_2_ReportMetadata; // make union when we have more versions

/********************************
 * Pipeline output
 * What the object received from the LLM pipeline should look like.
 ********************************/

export const pipelineOutput = z.object({
  data: reportData,
  metadata: reportMetadata,
});

export type PipelineOutput = z.infer<typeof pipelineOutput>;

/********************************
 * UI Report
 * Data needed only to display a report
 ********************************/

export const uiReportData = reportDataObj.omit({ sources: true });

export type UIReportData = z.infer<typeof uiReportData>;

/********************************
 * Downloaded report
 * When a user downloads a report, it gives a partial report object with some extra metadata
 ********************************/

const downloadReportSchema_v1 = z.tuple([
  z.literal("v0.2"),
  z.object({
    data: z.tuple([z.literal("v0.2"), uiReportData]),
    downloadTimestamp: z.number(),
  }),
]);

export const downloadReportSchema = downloadReportSchema_v1;

export type DownloadDataReportSchema = z.infer<typeof downloadReportSchema>;
