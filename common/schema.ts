import { z } from "zod";

export const sourceRow = z.object({
  comment: z.string(),
  id: z.string(),
  interview: z.string().optional(),
  video: z.string().optional(),
  timestamp: z.string().optional(),
});

export type SourceRow = z.infer<typeof sourceRow>;

export const pieChart = z.object({
  title: z.string(),
  items: z.object({ label: z.string(), count: z.number() }).array(),
});

export type PieChart = z.infer<typeof pieChart>;

export const userConfig = z.object({
  apiKey: z.string(),
  title: z.string(),
  question: z.string(),
  description: z.string(),
  systemInstructions: z.string(),
  clusteringInstructions: z.string(),
  extractionInstructions: z.string(),
  dedupInstructions: z.string(),
});

export type UserConfig = z.infer<typeof userConfig>;

export const systemConfig = z.object({
  model: z.string().optional(),
  batchSize: z.number(),
  filename: z.string(),
});

export type SystemConfig = z.infer<typeof systemConfig>;

const googleSheetData = z.object({
  url: z.string(),
  pieChartColumns: z.string().array(),
  filterEmails: z.string().array(),
  oneSubmissionPerEmail: z.boolean(),
});

export type GoogleSheetData = z.infer<typeof googleSheetData>;

const googleSheetDataPayload = z.tuple([
  z.literal("googlesheet"),
  googleSheetData,
]);

const csvDataPayload = z.tuple([z.literal("csv"), sourceRow.array()]);

export const dataPayload = z.union([csvDataPayload, googleSheetDataPayload]);

export type DataPayload = z.infer<typeof dataPayload>;

export const options = z.object({
  model: z.string().optional(),
  apiKey: z.string().optional(),
  data: sourceRow.array(),
  title: z.string(),
  question: z.string(),
  pieCharts: pieChart.array().optional(),
  description: z.string(),
  systemInstructions: z.string().optional(),
  clusteringInstructions: z.string().optional(),
  extractionInstructions: z.string().optional(),
  dedupInstructions: z.string().optional(),
  batchSize: z.number().optional(),
  filename: z.string().optional(),
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
export type Claim = {
  claim: string;
  quote: string;
  claimId?: string;
  topicName?: string;
  subtopicName?: string;
  commentId?: string;
  duplicates?: Claim[];
  duplicated?: boolean;
};

const claim = z.custom<Claim>();

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
  unmatchedClaims: z.array(claim),
  end: z.number().optional(),
  duration: z.string().optional(),
});

export type Tracker = z.infer<typeof tracker>;

export const subtopic = z.object({
  subtopicName: z.string(),
  subtopicShortDescription: z.string().optional(),
  subtopicId: z.string().optional(),
  claimsCount: z.number().optional(),
  claims: z.array(claim).optional(),
});

export type Subtopic = z.infer<typeof subtopic>;

export const topic = z.object({
  topicName: z.string(),
  topicShortDescription: z.string().optional(),
  topicId: z.string().optional(),
  claimsCount: z.number().optional(),
  subtopics: z.array(subtopic),
});

export type Topic = z.infer<typeof topic>;

export const taxonomy = z.array(topic);

export type Taxonomy = z.infer<typeof taxonomy>;

export const pipelineOutput = z.object({
  data: z.array(sourceRow),
  title: z.string(),
  question: z.string(),
  pieChart: z.array(pieChart).optional(),
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

export type PipelineOutput = z.infer<typeof pipelineOutput>;

export const sourceMap = z.record(z.string(), sourceRow);

export type SourceMap = z.infer<typeof sourceMap>;
