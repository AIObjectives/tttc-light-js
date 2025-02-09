import * as apiPyserver from "tttc-common/apiPyserver";
import { ClaimsStep } from "./types";
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
        "openai-api-key" : openaiAPIKey
      },
    });

const pyserverFetchClaims = typedFetch(apiPyserver.claimsRequest);

const logger =
  (prependMessage: string) =>
  <T>(arg: T): T => {
    console.log(prependMessage, arg);
    return arg;
  };

export async function claimsPipelineStep(env: Env, openaiAPIKey: string, input: ClaimsStep["data"]) {
  const { data, usage } = await pyserverFetchClaims(
    `${env.PYSERVER_URL}/claims`,
    input,
    openaiAPIKey,
  )
    .then((res) => res.json())
    .then(logger("claims step returns: "))
    .then(apiPyserver.claimsReply.parse);

  return { claims_tree: data, usage };
}
