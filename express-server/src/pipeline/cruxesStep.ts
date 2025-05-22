import * as apiPyserver from "tttc-common/apiPyserver";
import { CruxesStep } from "./types";
import { Env } from "../types/context";
import { handlePipelineStep } from "./handlePipelineStep";

export async function cruxesPipelineStep(env: Env, input: CruxesStep["data"]) {
  return await handlePipelineStep(apiPyserver.cruxesResponse, () =>
    fetch(`${env.PYSERVER_URL}/cruxes`, {
      method: "post",
      body: JSON.stringify(input),
      headers: {
        "Content-Type": "application/json",
        [apiPyserver.OPENAI_API_KEY_HEADER]: env.OPENAI_API_KEY,
      },
    }),
  );
}
