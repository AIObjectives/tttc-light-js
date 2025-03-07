import * as apiPyserver from "tttc-common/apiPyserver";
import { ClaimsStep } from "./types";
import { Env } from "../types/context";
import { z } from "zod";

const typedFetch =
  <T extends z.ZodTypeAny>(bodySchema: T) =>
  async (
    url: string,
    body: z.infer<T>,
    openaiAPIKey: string,
    isProd: boolean,
  ) => {
    const fetchOptions: RequestInit = {
      method: "POST",
      body: JSON.stringify(bodySchema.parse(body) as z.infer<T>),
      headers: {
        "Content-Type": "application/json",
        "openai-api-key": openaiAPIKey,
      },
      // wait for 7 minutes for full claims list
      // TODO: use message queue instead
      signal: AbortSignal.timeout(420000),
    };

    // Explicitly set redirect to "follow" in production and staging to ensure any server redirects
    // (including potential HTTP to HTTPS redirects) are properly followed
    if (isProd || env.NODE_ENV === "staging") {
      fetchOptions.redirect = "follow";
    }

    return await fetch(url, fetchOptions);
  };

const pyserverFetchClaims = typedFetch(apiPyserver.claimsRequest);

const logger =
  (prependMessage: string) =>
  <T>(arg: T): T => {
    console.log(prependMessage, arg);
    return arg;
  };

export async function claimsPipelineStep(
  env: Env,
  openaiAPIKey: string,
  input: ClaimsStep["data"],
) {
  const { data, usage } = await pyserverFetchClaims(
    `${env.PYSERVER_URL}/claims`,
    input,
    openaiAPIKey,
    env.NODE_ENV === "prod",
  )
    .then((res) => res.json())
    .then(logger("claims step returns: "))
    .then(apiPyserver.claimsResponse.parse);

  return { claims_tree: data, usage };
}
