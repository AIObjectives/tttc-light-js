import * as apiPyserver from "tttc-common/apiPyserver";
import { TopicSummariesStep } from "./types";
import { Env } from "../types/context";
import { handlePipelineStep } from "./handlePipelineStep";

export async function topicSummariesPipelineStep(
  env: Env,
  input: TopicSummariesStep["data"],
) {
  return await handlePipelineStep(
    apiPyserver.topicSummariesResponse,
    async () =>
      await fetch(`${env.PYSERVER_URL}/topic_summaries`, {
        method: "POST",
        body: JSON.stringify(input),
        headers: {
          "Content-Type": "application/json",
          [apiPyserver.OPENAI_API_KEY_HEADER]: env.OPENAI_API_KEY,
        },
      }),
  );
}
