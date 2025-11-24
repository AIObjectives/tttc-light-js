"use server";
import {
  DataPayload,
  SourceRow,
  LLMUserConfig,
  llmUserConfig,
} from "tttc-common/schema";
import Papa from "papaparse";
import { GenerateApiResponse, GenerateApiRequest } from "tttc-common/api";
import { validatedServerEnv } from "@/server-env";
import { logger } from "tttc-common/logger/browser";
import { formatData } from "tttc-common/csv-validation";

const submitActionLogger = logger.child({ module: "submit-action" });

const parseCSV = async (file: File): Promise<SourceRow[]> => {
  const buffer = await file.arrayBuffer();
  const parseResult = Papa.parse(Buffer.from(buffer).toString(), {
    header: true,
    skipEmptyLines: true,
  });

  // Format raw CSV data to SourceRow format with flexible column mapping
  return formatData(parseResult.data as Record<string, unknown>[]);
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
  const file = formData.get("dataInput") as File;
  const data = await parseCSV(file);
  if (!data || !data.length) {
    throw new Error("Missing data. Check your csv file");
  }

  const config: LLMUserConfig = llmUserConfig.parse({
    title: formData.get("title"),
    // question: formData.get("question"),
    description: formData.get("description"),
    clusteringInstructions: formData.get("clusteringInstructions"),
    systemInstructions: formData.get("systemInstructions"),
    extractionInstructions: formData.get("extractionInstructions"),
    dedupInstructions: formData.get("dedupInstructions"),
    summariesInstructions: formData.get("summariesInstructions"),
    cruxInstructions: formData.get("cruxInstructions"),
    // Checkbox inputs use 'on' | undefined, not true | false
    cruxesEnabled: formData.get("cruxesEnabled") === "on",
    bridgingEnabled: formData.get("bridgingEnabled") === "on",
  });
  const dataPayload: DataPayload = ["csv", data];
  submitActionLogger.debug(
    { cruxesEnabled: config.cruxesEnabled },
    "Submit action crux config",
  );
  const body: GenerateApiRequest = {
    userConfig: config,
    data: dataPayload,
    firebaseAuthToken,
  };
  submitActionLogger.debug(
    { cruxesEnabled: body.userConfig.cruxesEnabled },
    "Submit action body config",
  );
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
    throw new Error(
      errorData.error?.message ||
        errorData.error ||
        "An unknown error occurred",
    );
  }
  return await response.json();
}
