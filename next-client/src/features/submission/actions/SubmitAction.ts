"use server";
import Papa from "papaparse";
import { CommonEvents } from "tttc-common/analytics";
import type {
  CreateReportActionResult,
  GenerateApiRequest,
} from "tttc-common/api";
import { formatData } from "tttc-common/csv-validation";
import { ERROR_CODES, ERROR_MESSAGES } from "tttc-common/errors";
import { logger } from "tttc-common/logger/browser";
import {
  type DataPayload,
  type LLMUserConfig,
  llmUserConfig,
  type SourceRow,
} from "tttc-common/schema";
import { serverSideAnalyticsClient } from "@/lib/analytics/serverSideAnalytics";
import { validatedServerEnv } from "@/server-env";

const submitActionLogger = logger.child({ module: "submit-action" });

/**
 * Categorize error codes for analytics grouping
 */
function categorizeError(
  code: string,
): "auth" | "validation" | "server" | "rate_limit" {
  if (code.startsWith("AUTH_")) return "auth";
  if (
    code.startsWith("CSV_") ||
    code.startsWith("VALIDATION_") ||
    code.startsWith("INVALID_")
  )
    return "validation";
  if (code === "RATE_LIMIT_EXCEEDED") return "rate_limit";
  return "server";
}

/**
 * Track form submission errors for analytics
 */
async function trackFormError(code: string, requestId?: string): Promise<void> {
  try {
    const analytics = await serverSideAnalyticsClient();
    await analytics.track({
      name: CommonEvents.ERROR_OCCURRED,
      properties: {
        error_code: code,
        error_category: categorizeError(code),
        has_request_id: Boolean(requestId),
        form: "create_report",
      },
    });
  } catch (error) {
    // Don't let analytics failures affect the user flow
    submitActionLogger.warn({ error }, "Failed to track form error");
  }
}

const parseCSV = async (file: File): Promise<SourceRow[]> => {
  const buffer = await file.arrayBuffer();
  const parseResult = Papa.parse(Buffer.from(buffer).toString(), {
    header: true,
    skipEmptyLines: true,
  });

  // Format raw CSV data to SourceRow format with flexible column mapping
  return formatData(parseResult.data as Record<string, unknown>[]);
};

/**
 * Extract and parse LLM user config from form data.
 * Separated to reduce cyclomatic complexity in submitAction.
 */
const parseUserConfig = (formData: FormData): LLMUserConfig => {
  return llmUserConfig.parse({
    title: formData.get("title"),
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
    outputLanguage: formData.get("outputLanguage") || "English",
  });
};

export default async function submitAction(
  firebaseAuthToken: string | null,
  formData: FormData,
): Promise<CreateReportActionResult> {
  // Return error for missing auth instead of throwing
  if (!firebaseAuthToken) {
    await trackFormError(ERROR_CODES.AUTH_TOKEN_MISSING);
    return {
      status: "error",
      error: {
        code: ERROR_CODES.AUTH_TOKEN_MISSING,
        message: ERROR_MESSAGES.AUTH_TOKEN_MISSING,
      },
    };
  }

  try {
    // Parse CSV file
    const file = formData.get("dataInput") as File;
    const data = await parseCSV(file);

    // Return error for empty CSV instead of throwing
    if (!data || !data.length) {
      await trackFormError(ERROR_CODES.CSV_INVALID_FORMAT);
      return {
        status: "error",
        error: {
          code: ERROR_CODES.CSV_INVALID_FORMAT,
          message:
            "The CSV file appears to be empty. Please check your file and try again.",
        },
      };
    }

    const config = parseUserConfig(formData);

    const dataPayload: DataPayload = ["csv", data];
    submitActionLogger.debug(
      { cruxesEnabled: config.cruxesEnabled },
      "Submit action crux config",
    );

    const body: GenerateApiRequest = {
      userConfig: config,
      data: dataPayload,
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
        Authorization: `Bearer ${firebaseAuthToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorCode = errorData.error?.code || ERROR_CODES.INTERNAL_ERROR;
      const requestId = errorData.error?.requestId;
      await trackFormError(errorCode, requestId);
      return {
        status: "error",
        error: {
          code: errorCode,
          message: errorData.error?.message || ERROR_MESSAGES.INTERNAL_ERROR,
          requestId,
        },
      };
    }

    const responseData = await response.json();
    return { status: "success", data: responseData };
  } catch (error) {
    submitActionLogger.error({ error }, "Submit action failed");
    await trackFormError(ERROR_CODES.INTERNAL_ERROR);
    return {
      status: "error",
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message:
          error instanceof Error
            ? error.message
            : ERROR_MESSAGES.INTERNAL_ERROR,
      },
    };
  }
}
