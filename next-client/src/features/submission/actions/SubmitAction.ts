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
  console.log("data", data);

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
  console.log("config", config);
  const url = z.string().url().parse(process.env.PIPELINE_EXPRESS_URL);
  console.log("before");
  const blah = JSON.stringify(config);
  console.log("blah", blah);
  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(config),
    headers: {
      "Content-Type": "application/json",
    },
  });
  console.log("response", response);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error);
  }
  return await response.json();
}
