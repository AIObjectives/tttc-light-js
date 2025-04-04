import * as apiPyserver from "tttc-common/apiPyserver";
import { SortClaimTreeStep } from "./types";
import { Env } from "../types/context";
import { z } from "zod";

const typedFetch =
  <T extends z.ZodTypeAny>(bodySchema: T) =>
  async (url: string, body: z.infer<T>, apiKey: string) =>
    await fetch(url, {
      method: "PUT",
      body: JSON.stringify(bodySchema.parse(body) as z.infer<T>),
      headers: {
        "Content-Type": "application/json",
        [apiPyserver.OPENAI_API_KEY_HEADER]: apiKey,
      },
    });

const pyserverFetchSortClaimsTree = typedFetch(
  apiPyserver.sortClaimsTreeRequest,
);

const logger =
  (prependMessage: string) =>
  <T>(arg: T): T => {
    console.log(prependMessage, arg);
    return arg;
  };

export async function sortClaimsTreePipelineStep(
  env: Env,
  input: SortClaimTreeStep["data"],
) {
  const { data, usage, cost } = await pyserverFetchSortClaimsTree(
    `${env.PYSERVER_URL}/sort_claims_tree`,
    input,
    env.OPENAI_API_KEY,
  )
    .then((res) => res.json())
    .then(logger("sort claims step returns: "))
    .then(apiPyserver.sortClaimsTreeResponse.parse);
  return { data, usage, cost };
}
