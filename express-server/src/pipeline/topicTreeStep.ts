import * as apiPyserver from "tttc-common/apiPyserver";
import { TopicTreeStep } from "./types";
import { Env } from "../types/context";
import { z } from "zod";

const typedFetch =
  <T extends z.ZodTypeAny>(bodySchema: T) =>
  async (url: string, body: z.infer<T>) =>
    await fetch(url, {
      method: "post",
      body: JSON.stringify(bodySchema.parse(body) as z.infer<T>),
      headers: {
        "Content-Type": "application/json",
      },
    });

const pyserverFetchTopicTree = typedFetch(apiPyserver.topicTreeRequest);

export async function topicTreePipelineStep(
  env: Env,
  data: TopicTreeStep["data"],
) {
  console.log(env, data);
  const { tree, usage } = await pyserverFetchTopicTree(
    `${env.PYSERVER_URL}/topic_tree`,
    data,
  )
    .then((res) => res.json())
    .then(apiPyserver.topicTreeResponse.parse);

  return { tree, usage };
}
