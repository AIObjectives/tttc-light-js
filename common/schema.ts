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

export type Cache = {
  get: (key: string) => any;
  set: (key: string, value: any) => void;
};

export type Tracker = {
  start: number;
  costs: number;
  prompt_tokens: number;
  completion_tokens: number;
  unmatchedClaims: Claim[];
  end?: number;
  duration?: string;
};

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

export type Subtopic = {
  subtopicName: string;
  subtopicShortDescription?: string;
  subtopicId?: string;
  claimsCount?: number;
  claims?: Claim[];
};

export type Topic = {
  topicName: string;
  topicShortDescription?: string;
  topicId?: string;
  claimsCount?: number;
  subtopics: Subtopic[];
};

export type Taxonomy = Topic[];

export type PipelineOutput = {
  data: SourceRow[];
  title: string;
  question: string;
  pieCharts?: PieChart[];
  description: string;
  systemInstructions: string;
  clusteringInstructions: string;
  extractionInstructions: string;
  batchSize: number;
  tree: Taxonomy;
  start: number;
  costs: number;
  end?: number;
  duration?: string;
};

export type SourceMap = {
  [key: string]: SourceRow;
};
