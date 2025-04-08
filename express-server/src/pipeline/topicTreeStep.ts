import * as apiPyserver from "tttc-common/apiPyserver";
import { TopicTreeStep } from "./types";
import { Env } from "../types/context";
import { handlePipelineStep } from "./handlePipelineStep";

export async function topicTreePipelineStep(
  env: Env,
  input: TopicTreeStep["data"],
) {
  return await handlePipelineStep(
    apiPyserver.topicTreeResponse,
    async () =>
      await fetch(`${env.PYSERVER_URL}/topic_tree`, {
        method: "POST",
        body: JSON.stringify(input),
        headers: {
          "Content-Type": "application/json",
        },
      }),
  );
}
