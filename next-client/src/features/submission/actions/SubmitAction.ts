"use server";
import {
  DataPayload,
  SourceRow,
  LLMUserConfig,
  llmUserConfig,
} from "tttc-common/schema";
import Papa from "papaparse";
import { GenerateApiResponse, GenerateApiRequest } from "tttc-common/api";
import { z } from "zod";
import { validatedServerEnv } from "@src/server-env";

const parseCSV = async (file: File): Promise<SourceRow[]> => {
  const buffer = await file.arrayBuffer();
  return Papa.parse(Buffer.from(buffer).toString(), {
    header: true,
    skipEmptyLines: true,
  }).data as SourceRow[];
};

export default async function submitAction(
  firebaseAuthToken: string | null,
  formData: FormData,
): Promise<GenerateApiResponse> {
  // parses csv file
  // TODO: redact/overwrite API key, other fields are fine to log
  // console.log("starting to parse", formData);
  // if csv file is empty, return error
  const data = await parseCSV(formData.get("dataInput") as File);
  if (!data || !data.length) {
    throw new Error("Missing data. Check your csv file");
  }

  const config: LLMUserConfig = llmUserConfig.parse({
    apiKey: formData.get("apiKey"),
    title: formData.get("title"),
    // question: formData.get("question"),
    description: formData.get("description"),
    clusteringInstructions: formData.get("clusteringInstructions"),
    systemInstructions: formData.get("systemInstructions"),
    extractionInstructions: formData.get("extractionInstructions"),
    dedupInstructions: formData.get("dedupInstructions"),
  });
  const dataPayload: DataPayload = ["csv", data];

  const body: GenerateApiRequest = {
    userConfig: config,
    data: dataPayload,
    firebaseAuthToken,
  };

  const url = new URL("create", validatedServerEnv.PIPELINE_EXPRESS_URL);

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error);
  }
  return await response.json();
}
