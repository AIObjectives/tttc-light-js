import type { Comment, LLMConfig, TopicTree, ClaimsTree } from './types';

export interface TopicTreeTest {
  name: string;
  input: {
    llm: LLMConfig;
    comments: Comment[];
  };
  expected: TopicTree;
}

export interface ClaimTest {
  name: string;
  input: {
    llm: LLMConfig;
    comments: Comment[];
    tree: TopicTree;
  };
  expected: ClaimsTree;
}

export interface TestCases {
  sample_inputs: {
    min_pets_1: Comment[];
    min_pets_3: Comment[];
    dupes_pets_5: Comment[];
  };
  topic_tree_tests: TopicTreeTest[];
  claim_tests: ClaimTest[];
} 