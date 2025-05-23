import { z } from "zod";

//  ********************************
//  * General
//  ********************************/

export const pipelineComment = z.object({
  id: z.string(),
  text: z.string(),
  speaker: z.string(),
});

export type PipelineComment = z.infer<typeof pipelineComment>;

/**
 * Contains information about/for the llm
 */
const llmConfig = z.object(
  {
    model_name: z.string(),
    system_prompt: z.string(),
    user_prompt: z.string(),
  },
  { invalid_type_error: "Invalid llmConfig" },
);

export type LLMConfig = z.infer<typeof llmConfig>;

/**
 * Header name for OpenAI API key
 */
export const OPENAI_API_KEY_HEADER = "X-OpenAI-API-Key";

/**
 * Pipeline line broken into a few steps.
 */
export const pipelineSteps = z.enum([
  "topic_tree",
  "claims",
  "sort_claims_tree",
  "cruxes",
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
  text: z.string(),
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

export type PartialTopic = z.infer<typeof partialTopic>;

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
  counts: z.object({
    claims: z.number(),
    speakers: z.number(),
  }),
  topics: z
    .tuple([
      z.string(),
      z.object({
        counts: z.object({
          claims: z.number(),
          speakers: z.number(),
        }),
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
    cost: z.number(),
  },
  { invalid_type_error: "Invalid topic tree response" },
);

export type TopicTreeResponse = z.infer<typeof topicTreeResponse>;

//  ********************************
//  * claims
//  ********************************/

export const claimsRequest = z.object(
  {
    tree: z.object({
      taxonomy: partialTopic.array(),
    }),
    comments: comment.array(),
    llm: llmConfig,
  },
  { invalid_type_error: "Invalid claims request object" },
);
export type ClaimsRequest = z.infer<typeof claimsRequest>;

export const claimsReply = z.object({
  data: claimsTree,
  usage,
  cost: z.number(),
});

export type ClaimsReply = z.infer<typeof claimsReply>;

//  ********************************
//  * sort_claims_tree
//  ********************************/

export const sortClaimsTreeRequest = z.object({
  tree: claimsTree,
  llm: llmConfig,
  sort: z.string(),
});
export type SortClaimsTreeRequest = z.infer<typeof sortClaimsTreeRequest>;

export const sortClaimsTreeResponse = z.object({
  data: sortedTopic.array(),
  usage: usage,
  cost: z.number(),
});

export type SortClaimsTreeResponse = z.infer<typeof sortClaimsTreeResponse>;

//  ********************************
//  * cruxes
//  ********************************/

/**
 * Crux claim extraction in several formats
 * - basic details of an extractec cruxClaim: LLM-generated crux claim,
 *   lists of speakers who agree/disagree, LLM-generated explanation
 * - controversy matrix: numeric scores for the cross-product of crux claims,
 *   higher score is more controversial
 * - human-readable cruxes: top K scores and corresponding crux pairs from the
 *   controversy matrix
 * - one cruxDetails object to package this together
 */

const cruxClaim = z.object({
  cruxClaim: z.string(),
  agree: z.array(z.string()),
  disagree: z.array(z.string()),
  explanation: z.string(),
});

const controversyMatrix = z.array(z.array(z.number()));

const scoredCruxPair = z.object({
  score: z.number(),
  cruxA: z.string(),
  cruxB: z.string(),
});

export const cruxesResponse = z.object({
  cruxClaims: cruxClaim.array(),
  controversyMatrix: controversyMatrix,
  topCruxes: scoredCruxPair.array(),
  usage,
  cost: z.number(),
});

export const cruxesRequest = z.object({
  topics: partialTopic.array(),
  crux_tree: claimsTree,
  llm: llmConfig,
  top_k: z.number(),
});

export type CruxesRequest = z.infer<typeof cruxesRequest>;
