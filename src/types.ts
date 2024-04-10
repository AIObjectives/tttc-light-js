export type SourceRow = {
  comment: string;
  id: string;
  interview?: string;
  video?: string;
  timestamp?: string;
};

export type PieChart = {
  title: string;
  items: { label: string; count: number }[];
};

export type Options = {
  apiKey?: string;
  data?: SourceRow[];
  title: string;
  question: string;
  pieCharts?: PieChart[];
  description: string;
  systemInstructions?: string;
  clusteringInstructions?: string;
  extractionInstructions?: string;
  dedupInstructions?: string;
  batchSize?: number;
  filename?: string;
  googleSheet?: {
    url: string;
    pieChartColumns?: string[];
    filterEmails?: string[];
    oneSubmissionPerEmail?: boolean;
  };
};

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
