export type SourceRow = {
  comment: string;
  id: string;
  interview?: string;
  video?: string;
  timestamp?: string;
};

export type Options = {
  data: SourceRow[];
  title: string;
  question: string;
  description: string;
  systemInstructions?: string;
  clusteringInstructions?: string;
  extractionInstructions?: string;
  batchSize?: number;
};

export type Cache = {
  get: (key: string) => any;
  set: (key: string, value: any) => void;
};

export type Tracker = {
  start: number;
  costs: number;
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
