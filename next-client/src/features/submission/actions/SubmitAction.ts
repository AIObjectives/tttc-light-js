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
import { serverEnv } from "@/server-env";

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
  if (!firebaseAuthToken) {
    throw new Error("You need to be logged in to create a report.");
  }
  // parses csv file
  // TODO: redact/overwrite API key, other fields are fine to log
  // console.log("starting to parse", formData);
  // if csv file is empty, return error
  const data = await parseCSV(formData.get("dataInput") as File);
  if (!data || !data.length) {
    throw new Error("Missing data. Check your csv file");
  }

  const tempCruxInstructions = `I'm going to give you a topic with a description and a list of high-level claims about this topic made by different participants,
  identified by pseudonyms like "Person 1" or "A". I want you to formulate a new, specific statement called a "cruxClaim"
  which would best split the participants into two groups, based on all their
  statements on this topic: one group which would agree with the statement, and one which would disagree.
  Please explain your reasoning and assign participants into "agree" and "disagree" groups.
  return a JSON object of the form
  {
    "crux" : {
      "cruxClaim" : string // the new extracted claim
      "agree" : list of strings // list of the given participants who would agree with the cruxClaim
      "disagree" : list strings // list of the given participants who would disagree with the cruxClaim
      "explanation" : string // reasoning for why you synthesized this cruxClaim from the participants' perspective
    }
  }
  `;
  const config: LLMUserConfig = llmUserConfig.parse({
    apiKey: formData.get("apiKey"),
    title: formData.get("title"),
    // question: formData.get("question"),
    description: formData.get("description"),
    clusteringInstructions: formData.get("clusteringInstructions"),
    systemInstructions: formData.get("systemInstructions"),
    extractionInstructions: formData.get("extractionInstructions"),
    dedupInstructions: formData.get("dedupInstructions"),
    cruxInstructions: tempCruxInstructions,
  });
  const dataPayload: DataPayload = ["csv", data];

  const body: GenerateApiRequest = {
    userConfig: config,
    data: dataPayload,
    firebaseAuthToken,
  };

  const url = new URL("create", serverEnv.PIPELINE_EXPRESS_URL);

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
