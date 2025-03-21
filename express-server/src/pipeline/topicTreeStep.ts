import * as apiPyserver from "tttc-common/apiPyserver";
import { TopicTreeStep } from "./types";
import { Env } from "../types/context";
import { z } from "zod";
import { Environment, requiresHttps } from "tttc-common/environmentValidation";

const typedFetch =
  <T extends z.ZodTypeAny>(bodySchema: T) =>
  async (
    url: string,
    body: z.infer<T>,
    openaiAPIKey: string,
    currentEnv: string,
  ) => {
    const fetchOptions: RequestInit = {
      method: "POST",
      body: JSON.stringify(bodySchema.parse(body) as z.infer<T>),
      headers: {
        "Content-Type": "application/json",
        "openai-api-key": openaiAPIKey,
      },
    };

    // Explicitly set redirect to "follow" in production and staging to ensure any server redirects
    // (including potential HTTP to HTTPS redirects) are properly followed
    if (requiresHttps(currentEnv as Environment)) {
      fetchOptions.redirect = "follow";
    }

    return await fetch(url, fetchOptions);
  };

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
  const { data, usage, cost } = await pyserverFetchTopicTree(
    `${env.PYSERVER_URL}/topic_tree`,
    input,
    openaiAPIKey,
    env.NODE_ENV,
  )
    .then((res) => res.json())
    .then(logger("topic tree step returns: "))
    .then(apiPyserver.topicTreeResponse.parse);

  return { data, usage, cost };
}
