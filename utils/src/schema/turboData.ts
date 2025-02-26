import { z } from "zod";
import * as schema from "../../../common/schema";

export const turboSourceRow = z.object({
  "comment-body": z.string(),
  "comment-id": z.string(),
  interview: z.string().optional(),
  video: z.string().optional(),
  timestamp: z.string().optional(),
});

export type TurboSourceRow = z.infer<typeof turboSourceRow>;

export const turboClaim = z.object({
  claim: z.string(),
  quote: z.string(),
  topicName: z.string(),
  subtopicName: z.string(),
  timestamp: z.string().default("0:00:00"),
});

export type TurboClaim = z.infer<typeof turboClaim>;

export const turboClaimArg = z.object({
  id: z.string(),
  comment: z.string(),
  interview: z.string().optional(),
  claims: turboClaim.array(),
});

export type TurboClaimArg = z.infer<typeof turboClaimArg>;

export const turboClaimMap = z.record(z.string(), turboClaimArg);

export type TurboClaimMap = z.infer<typeof turboClaimMap>;

export const turboSubtopic = z.object({
  subtopicName: z.string(),
  subtopicShortDescription: z.string(),
});

export const turboTopic = z.object({
  topicName: z.string(),
  topicShortDescription: z.string(),
  subtopics: turboSubtopic.array(),
});

export const turboTopicClustering = z.object({ topics: turboTopic.array() });

export type TurboTopicClustering = z.infer<typeof turboTopicClustering>;

export type TranslatedReport = {
  merge: schema.Taxonomy;
  translations: {
    "es-AR": {
      topics: schema.Taxonomy;
    };
    "en-US": {
      topics: schema.Taxonomy;
    };
  };
};
//  z.object({
//   blah: schema.taxonomy
// })

//   export type TranslatedReport = z.infer<typeof translatedReport>
