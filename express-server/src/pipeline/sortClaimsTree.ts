import * as apiPyserver from "tttc-common/apiPyserver";
import { SortClaimTreeStep } from "./types";
import { Env } from "../types/context";
import { z } from "zod";

const typedFetch =
  <T extends z.ZodTypeAny>(bodySchema: T) =>
  async (url: string, body: z.infer<T>) =>
    await fetch(url, {
      method: "put",
      body: JSON.stringify(bodySchema.parse(body) as z.infer<T>),
      headers: {
        "Content-Type": "application/json",
      },
    });

const pyserverFetchSortClaimsTree = typedFetch(
  apiPyserver.sortClaimsTreeRequest,
);

export async function sortClaimsTreePipelineStep(
  env: Env,
  data: SortClaimTreeStep["data"],
) {
  return await pyserverFetchSortClaimsTree(
    `${env.PYSERVER_URL}/sort_claims_tree`,
    data,
  )
    .then((res) => res.json())
    .then(apiPyserver.sortClaimsTreeResponse.parse);
}
