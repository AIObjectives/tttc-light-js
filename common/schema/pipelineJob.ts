/**
 * Schema for pipeline job messages
 * Shared between express-server (producer) and pipeline-worker (consumer)
 */

import { z } from "zod";

/**
 * Schema for comment in pipeline job
 */
const commentSchema = z.object({
  comment_id: z.string(),
  comment_text: z.string(),
  speaker: z.string().default("participant"),
  votes: z.number().optional(),
  agrees: z.number().optional(),
  disagrees: z.number().optional(),
});

/**
 * Schema for Firebase details in pipeline job
 */
const firebaseDetailsSchema = z.object({
  reportId: z.string(),
  userId: z.string(),
});

/**
 * Schema for pipeline job message
 */
export const pipelineJobSchema = z.object({
  config: z.object({
    firebaseDetails: firebaseDetailsSchema,
    llm: z.object({
      model: z.string(),
    }),
    instructions: z.object({
      systemInstructions: z.string(),
      clusteringInstructions: z.string(),
      extractionInstructions: z.string(),
      dedupInstructions: z.string(),
      summariesInstructions: z.string(),
      cruxInstructions: z.string(),
      outputLanguage: z.string().optional(),
    }),
    options: z.object({
      cruxes: z.boolean(),
      bridging: z.boolean().optional(),
      sortStrategy: z.enum(["numPeople", "numClaims"]).default("numPeople"),
    }),
    env: z.object({
      OPENAI_API_KEY: z.string(),
    }),
  }),
  data: z.array(commentSchema),
  reportDetails: z.object({
    title: z.string(),
    description: z.string(),
    question: z.string(),
    filename: z.string(),
  }),
});

export type PipelineJobMessage = z.infer<typeof pipelineJobSchema>;
