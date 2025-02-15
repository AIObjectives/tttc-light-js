export interface Comment {
  id: string;
  text: string;
  speaker?: string;
}

export interface LLMConfig {
  model_name: string;
  system_prompt: string;
  user_prompt: string;
  api_key: string;
}

export interface Subtopic {
  subtopicName: string;
  subtopicShortDescription: string;
}

export interface Topic {
  topicName: string;
  topicShortDescription: string;
  subtopics: Subtopic[];
}

export interface TopicTree {
  taxonomy: Topic[];
}

export interface Claim {
  claim: string;
  quote: string;
  topicName: string;
  subtopicName: string;
  commentId: string;
  speaker?: string;
  duplicates?: Claim[];
}

export interface SubtopicClaims {
  total: number;
  claims: Claim[];
  speakers?: Set<string>;
}

export interface TopicSubtopics {
  [subtopic: string]: SubtopicClaims;
}

export interface ClaimsTree {
  [topic: string]: {
    total: number;
    subtopics: TopicSubtopics;
    speakers?: Set<string>;
  };
} 