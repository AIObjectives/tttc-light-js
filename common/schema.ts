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

const googleSheetDataPayload = z.tuple([
  z.literal("googlesheet"),
  googleSheetData,
]);

/**
 * Data Payload
 * Union of CSV and Google Sheet inputs
 */
export const dataPayload = z.union([csvDataPayload, googleSheetDataPayload]);

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
  apiKey: z.string(),
  title: z.string(),
  question: z.string(),
  description: z.string(),
  systemInstructions: z.string(),
  clusteringInstructions: z.string(),
  extractionInstructions: z.string(),
  dedupInstructions: z.string(),
});

export type LLMUserConfig = z.infer<typeof llmUserConfig>;

export const llmSystemConfig = z.object({
  model: z.string().optional(),
  batchSize: z.number(),
  filename: z.string(),
});

export type oldSystemConfig = z.infer<typeof llmSystemConfig>;

export type DataPayload = z.infer<typeof dataPayload>;

export const options = z.object({
  model: z.string(),
  apiKey: z.string(),
  data: sourceRow.array(),
  title: z.string(),
  question: z.string(),
  pieCharts: llmPieChart.array().optional(),
  description: z.string(),
  systemInstructions: z.string(),
  clusteringInstructions: z.string(),
  extractionInstructions: z.string(),
  dedupInstructions: z.string(),
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

export type Options = z.infer<typeof options>;

// Zod has trouble with self-referential types, so leave this be until we need to parse
export type LLMClaim = {
  claim: string;
  quote: string;
  claimId?: string;
  topicName: string;
  subtopicName?: string;
  commentId?: string;
  duplicates?: LLMClaim[];
  duplicated?: boolean;
};

const oldclaim = z.custom<LLMClaim>();

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
  unmatchedClaims: z.array(oldclaim),
  end: z.number().optional(),
  duration: z.string().optional(),
});

export type Tracker = z.infer<typeof tracker>;

export const llmSubtopic = z.object({
  subtopicName: z.string(),
  subtopicShortDescription: z.string().optional(),
  subtopicId: z.string().optional(),
  claimsCount: z.number().optional(),
  claims: z.array(oldclaim).optional(),
});

export type Subtopic = z.infer<typeof llmSubtopic>;

export const llmTopic = z.object({
  topicName: z.string(),
  topicShortDescription: z.string().optional(),
  topicId: z.string().optional(),
  claimsCount: z.number().optional(),
  subtopics: z.array(llmSubtopic),
});

export type LLMTopic = z.infer<typeof llmTopic>;

export type Topic = z.infer<typeof topic>;

export const taxonomy = z.array(llmTopic);

export type Taxonomy = z.infer<typeof taxonomy>;

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
    link: z.string(),
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
    beginTimestamp: z.string(),
    endTimestamp: z.string(),
  }),
]);

const referenceAudio = z.tuple([
  z.literal("audio"),
  z.object({
    beginTimestamp: z.string(),
    endTimestamp: z.string(),
  }),
]);

export const reference = z.object({
  id: z.string(),
  sourceId: z.string(),
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
 * Topic
 * Topics are categories of claims that share some relation.
 ********************************/
export const topic = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  claims: z.array(claim),
});

/********************************
 * Theme
 * Themes are broader categories of topics
 ********************************/
export const theme = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  topics: z.array(topic),
});

export type Theme = z.infer<typeof theme>;
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
 * Report Data
 * Contains all the information that a report needs to display
 ********************************/

export const reportDataObj = z.object({
  title: z.string(),
  description: z.string(),
  themes: z.array(theme),
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
const openAIModels = z.enum([
  "gpt-4",
  "gpt-4-32k",
  "gpt-3.5-turbo",
  "gpt-3.5-turbo-16k",
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
  buildProcess: z.array(pipelineStep),
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
