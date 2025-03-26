import * as apiPyserver from "tttc-common/apiPyserver";
import { CruxesStep } from "./types";
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
      // wait for up to 3.5 minutes for cruxes to process
      // TODO: use message queue instead
      signal: AbortSignal.timeout(210000),
    };

    // Explicitly set redirect to "follow" in production and staging to ensure any server redirects
    // (including potential HTTP to HTTPS redirects) are properly followed
    if (requiresHttps(currentEnv as Environment)) {
      fetchOptions.redirect = "follow";
    }

    return await fetch(url, fetchOptions);
  };

const pyserverFetchClaims = typedFetch(apiPyserver.cruxesRequest);

const logger =
  (prependMessage: string) =>
  <T>(arg: T): T => {
    console.log(prependMessage, arg);
    return arg;
  };

export async function cruxesPipelineStep(
  env: Env,
  openaiAPIKey: string,
  input: CruxesStep["data"],
) {
  const { cruxClaims, controversyMatrix, topCruxes, usage, cost } =
    await pyserverFetchClaims(
      `${env.PYSERVER_URL}/cruxes`,
      input,
      openaiAPIKey,
      env.NODE_ENV
    )
      .then((res) => res.json())
      .then(logger("cruxes step returns: "))
      .then(apiPyserver.cruxesResponse.parse);

  return { cruxClaims, controversyMatrix, topCruxes, usage, cost };
}
