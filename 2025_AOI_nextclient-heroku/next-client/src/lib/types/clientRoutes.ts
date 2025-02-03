import { z } from "zod";

export const feedbackRequest = z.object({
  userId: z.string().nullable(),
  text: z.string(),
});

export type FeedbackRequest = z.infer<typeof feedbackRequest>;

export const feedbackResponseData = z.union([
  z.tuple([z.literal("data"), z.literal("success")]),
  z.tuple([z.literal("error"), z.object({ message: z.string() })]),
]);

export const feedbackResponse = z.object({
  response: feedbackResponseData,
});

export type FeedbackResponse = z.infer<typeof feedbackResponse>;
