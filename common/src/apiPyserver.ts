import type { LLMConfig, Comment, TopicTree, ClaimsTree } from './types';

export type PipelineSteps = "topic_tree" | "claims" | "sort_claims_tree";

export interface TopicTreeRequest {
  llm: LLMConfig;
  comments: Comment[];
}

export interface ClaimsRequest {
  llm: LLMConfig;
  comments: Comment[];
  tree: TopicTree;
}

export interface SortClaimsTreeRequest {
  llm: LLMConfig;
  tree: ClaimsTree;
  sort: string;
}

// Add other necessary types... 