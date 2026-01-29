/**
 * Schema for pipeline job messages
 * Shared between express-server (producer) and pipeline-worker (consumer)
 */

import { z } from "zod";

/**
 * Schema for comment in pipeline job
 */
const commentSchema = z.object({
  comment_id: z.string().min(1, "Comment ID cannot be empty"),
  comment_text: z.string().min(1, "Comment text cannot be empty"),
  speaker: z.string().default("participant"),
  votes: z.number().optional(),
  agrees: z.number().optional(),
  disagrees: z.number().optional(),
});

/**
 * Schema for Firebase details in pipeline job
 */
const firebaseDetailsSchema = z.object({
  reportId: z.string().min(1, "Report ID cannot be empty"),
  userId: z.string().min(1, "User ID cannot be empty"),
});

/**
 * Schema for pipeline job message
 */
export const pipelineJobSchema = z.object({
  config: z.object({
    firebaseDetails: firebaseDetailsSchema,
    llm: z.object({
      model: z.string().min(1, "Model name cannot be empty"),
    }),
    instructions: z.object({
      systemInstructions: z
        .string()
        .min(1, "System instructions cannot be empty"),
      clusteringInstructions: z
        .string()
        .min(1, "Clustering instructions cannot be empty"),
      extractionInstructions: z
        .string()
        .min(1, "Extraction instructions cannot be empty"),
      dedupInstructions: z
        .string()
        .min(1, "Dedup instructions cannot be empty"),
      summariesInstructions: z
        .string()
        .min(1, "Summaries instructions cannot be empty"),
      cruxInstructions: z.string().min(1, "Crux instructions cannot be empty"),
      outputLanguage: z.string().optional(),
    }),
    options: z.object({
      cruxes: z.boolean(),
      bridging: z.boolean().optional(),
      sortStrategy: z.enum(["numPeople", "numClaims"]).default("numPeople"),
    }),
    env: z.object({
      OPENAI_API_KEY: z.string().min(1, "API key cannot be empty"),
    }),
  }),
  data: z.array(commentSchema),
  reportDetails: z.object({
    title: z.string().min(1, "Title cannot be empty"),
    description: z.string().min(1, "Description cannot be empty"),
    question: z.string().min(1, "Question cannot be empty"),
    filename: z.string().min(1, "Filename cannot be empty"),
  }),
});

export type PipelineJobMessage = z.infer<typeof pipelineJobSchema>;
