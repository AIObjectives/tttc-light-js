import * as apiPyserver from "tttc-common/apiPyserver";
import { TopicTreeStep } from "./types";
import { Env } from "../types/context";
import { z } from "zod";

const typedFetch =
  <T extends z.ZodTypeAny>(bodySchema: T) =>
  async (url: string, body: z.infer<T>, openaiAPIKey: string) =>
    await fetch(url, {
      method: "POST",
      body: JSON.stringify(bodySchema.parse(body) as z.infer<T>),
      headers: {
        "Content-Type": "application/json",
        "openai-api-key": openaiAPIKey,
      },
    });

const pyserverFetchTopicTree = typedFetch(apiPyserver.topicTreeRequest);

const logger =
  (prependMessage: string) =>
  <T>(arg: T): T => {
    console.log(prependMessage, arg);
    return arg;
  };

export async function topicTreePipelineStep(
  env: Env,
  openaiAPIKey: string,
  input: TopicTreeStep["data"],
) {
  const { data, usage } = await pyserverFetchTopicTree(
    `${env.PYSERVER_URL}/topic_tree`,
    input,
    openaiAPIKey,
  )
    .then((res) => res.json())
    .then(logger("topic tree step returns: "))
    .then(apiPyserver.topicTreeResponse.parse);

  return { data, usage };
}
