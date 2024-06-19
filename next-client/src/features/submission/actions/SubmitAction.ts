"use server";
import { Options, SourceRow, options } from "tttc-common/schema";
import Papa from "papaparse";
import { GenerateApiResponse } from "tttc-common/api";
import { z } from "zod";

export default async function submitAction(
  _: GenerateApiResponse | null,
  formData: FormData,
): Promise<GenerateApiResponse> {
  // parses csv file
  console.log("starting to parse")
  const parseCSV = async (file: File): Promise<SourceRow[]> => {
    const buffer = await file.arrayBuffer();
    return Papa.parse(Buffer.from(buffer).toString(), {
      header: true,
      skipEmptyLines: true,
    }).data as SourceRow[];
  };
  // if csv file is empty, return error
  const data = await parseCSV(formData.get("dataInput") as File);
  if (!data || !data.length) {
    throw new Error("Missing data. Check your csv file");
  }
  console.log(data);
  const config: Options = options.parse({
    apiKey: formData.get("apiKey"),
    data: data,
    title: formData.get("title"),
    question: formData.get("question"),
    description: formData.get("description"),
    systemInstructions: formData.get("systemInstructions"),
    extractionInstructions: formData.get("extractionInstructions"),
    dedupInstructions: formData.get("dedupInstructions"),
  });
  const url = z.string().url().parse(process.env.PIPELINE_EXPRESS_URL);
  const blah = JSON.stringify(config);
  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(config),
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
