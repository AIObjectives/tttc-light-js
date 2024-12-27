import * as apiPyserver from "tttc-common/apiPyserver";
import { ClaimsStep } from "./types";
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

const pyserverFetchClaims = typedFetch(apiPyserver.claimsRequest);

export async function claimsPipelineStep(env: Env, data: ClaimsStep["data"]) {
  const { claims_tree, usage } = await pyserverFetchClaims(
    `${env.PYSERVER_URL}/claims`,
    data,
  )
    .then((res) => res.json())
    .then(apiPyserver.claimsReply.parse);

  return { claims_tree, usage };
}
