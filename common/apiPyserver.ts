import { z } from "zod";

//  ********************************
//  * General
//  ********************************/

/**
 * Contains information about/for the llm
 */
const llmConfig = z.object(
  {
    model_name: z.string(),
    system_prompt: z.string(),
    user_prompt: z.string(),
    api_key: z.string(),
  },
  { invalid_type_error: "Invalid llmConfig" },
);

export type LLMConfig = z.infer<typeof llmConfig>;

/**
 * Pipeline line broken into a few steps.
 */
export const pipelineSteps = z.enum([
  "topic_tree",
  "claims",
  "sort_claims_tree",
]);
export type PipelineSteps = z.infer<typeof pipelineSteps>;

const usage = z.object({
  completion_tokens: z.number(),
  prompt_tokens: z.number(),
  total_tokens: z.number(),
});

export type Usage = z.infer<typeof usage>;

//  ********************************
//  * data
//  ********************************/

/**
 * Comments as consumed in the pyserver pipeline. Slightly different than schema.
 */
const comment = z.object({
  id: z.string(),
  text: z.string().min(1, "Empty comment"),
  speaker: z.string(),
});

/**
 * Partial subtopic without id nor claims. Used for first step.
 */
const partialSubtopic = z.object({
  subtopicName: z.string(),
  subtopicShortDescription: z.string(),
});

/**
 * Partial topic without id. Used for first step.
 */
const partialTopic = z.object({
  topicName: z.string(),
  topicShortDescription: z.string(),
  subtopics: partialSubtopic.array(),
});

/**
 * Claims without id and duplications. Used for second and third step.
 */
const baseClaim = z.object({
  claim: z.string(),
  quote: z.string(),
  speaker: z.string(),
  topicName: z.string(),
  subtopicName: z.string(),
  commentId: z.string(),
});

/**
 * Contains a subtopic's claims.
 */
const subtopicClaimTreeNode = z.object({
  total: z.number(),
  claims: baseClaim.array(),
});

/**
 * Contains a topic's subtopics.
 */
const claimsTreeNode = z.object({
  total: z.number(),
  subtopics: z.record(z.string(), subtopicClaimTreeNode),
});

export type ClaimsTreeNode = z.infer<typeof claimsTreeNode>;

/**
 * Record of topics -> claim trees
 */
const claimsTree = z.record(z.string(), claimsTreeNode);

export type ClaimsTree = z.infer<typeof claimsTree>;

export const sortReportBy = z.enum(["numPeople", "numClaims"]);
export type SortReportBy = z.infer<typeof sortReportBy>;

/**
 * Claims that are duplicates of another claim.
 */
const dupedClaims = z.object({
  claim: z.string(),
  quote: z.string(),
  speaker: z.string(),
  topicName: z.string(),
  subtopicName: z.string(),
  commentId: z.string(),
  duplicated: z.boolean(),
});

/**
 * Top level claims, contains an array of duplicate claims
 */
const claimsWithDuplicates = z.object({
  claim: z.string(),
  quote: z.string(),
  speaker: z.string(),
  topicName: z.string(),
  subtopicName: z.string(),
  commentId: z.string(),
  duplicates: dupedClaims.array().default([]),
});

const sortedSubtopic = z.object({
  total: z.number(),
  topics: z
    .tuple([
      z.string(),
      z.object({
        total: z.number(),
        claims: claimsWithDuplicates.array(),
      }),
    ])
    .array(),
});

const sortedTopic = z.tuple([z.string(), sortedSubtopic]);

//  ********************************
//  * topic_tree
//  ********************************/

export const topicTreeRequest = z.object(
  {
    comments: comment
      .array()
      .min(1, "Empty comments array for topicTreeRequest"),
    llm: llmConfig,
  },
  { invalid_type_error: "Invalid topic tree request object" },
);
export type TopicTreeRequest = z.infer<typeof topicTreeRequest>;

export const topicTreeResponse = z.object(
  {
    data: partialTopic.array(),
    usage,
  },
  { invalid_type_error: "Invalid topic tree response" },
);

export type TopicTreeResponse = z.infer<typeof topicTreeResponse>;

//  ********************************
//  * claims
//  ********************************/

export const claimsRequest = z.object({
  tree: z.object({
    taxonomy: partialTopic.array(),
  }),
  comments: comment.array(),
  llm: llmConfig,
});
export type ClaimsRequest = z.infer<typeof claimsRequest>;

export const claimsReply = z.object({
  data: claimsTree,
  usage,
});

//  ********************************
//  * sort_claims_tree
//  ********************************/

export const sortClaimsTreeRequest = z.object({
  tree: claimsTree,
  llm: llmConfig,
  sort: z.string(), //ReportBy: sortReportBy,
});
export type SortClaimsTreeRequest = z.infer<typeof sortClaimsTreeRequest>;

export const sortClaimsTreeResponse = z.object({
  data: sortedTopic.array(),
});

export type SortClaimsTreeResponse = z.infer<typeof sortClaimsTreeResponse>;
