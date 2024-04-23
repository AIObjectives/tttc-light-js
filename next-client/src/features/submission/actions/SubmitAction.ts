"use server";
import {
  DataPayload,
  SourceRow,
  UserConfig,
  options,
  userConfig,
} from "tttc-common/schema";
import Papa from "papaparse";
import { GenerateApiResponse, GenerateApiRequest } from "tttc-common/api";
import { z } from "zod";

export default async function submitAction(
  _: GenerateApiResponse | null,
  formData: FormData,
): Promise<GenerateApiResponse> {
  // parses csv file
  const parseCSV = async (file: File): Promise<SourceRow[]> => {
    const buffer = await file.arrayBuffer();
    return Papa.parse(Buffer.from(buffer).toString(), { header: true })
      .data as SourceRow[];
  };
  console.log("from", parseCSV);
  // if csv file is empty, return error
  const data = await parseCSV(formData.get("dataInput") as File);
  if (!data || !data.length) {
    throw new Error("Missing data. Check your csv file");
  }

  const config: UserConfig = userConfig.parse({
    apiKey: formData.get("apiKey"),
    title: formData.get("title"),
    question: formData.get("question"),
    description: formData.get("description"),
    clusteringInstructions: formData.get("clusteringInstructions"),
    systemInstructions: formData.get("systemInstructions"),
    extractionInstructions: formData.get("extractionInstructions"),
    dedupInstructions: formData.get("dedupInstructions"),
  });
  const dataPayload: DataPayload = ["csv", data];

  const body: GenerateApiRequest = { userConfig: config, dataPayload };

  const url = z.string().url().parse(process.env.PIPELINE_EXPRESS_URL);

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
