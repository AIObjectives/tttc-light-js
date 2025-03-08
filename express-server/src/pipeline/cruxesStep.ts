import * as apiPyserver from "tttc-common/apiPyserver";
import { CruxesStep } from "./types";
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

const pyserverFetchClaims = typedFetch(apiPyserver.cruxesRequest);

const logger =
  (prependMessage: string) =>
  <T>(arg: T): T => {
    console.log(prependMessage, arg);
    return arg;
  };

export async function cruxesPipelineStep(env: Env, input: CruxesStep["data"]) {
  const { cruxClaims, controversyMatrix, topCruxes, usage, cost } =
    await pyserverFetchClaims(`${env.PYSERVER_URL}/cruxes/`, input)
      .then((res) => res.json())
      .then(logger("cruxes step returns: "))
      .then(apiPyserver.cruxesResponse.parse);

  return { cruxClaims, controversyMatrix, topCruxes, usage, cost};
}
