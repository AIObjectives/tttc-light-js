import * as apiPyserver from "tttc-common/apiPyserver";
import { ClaimsStep } from "./types";
import { Env } from "../types/context";
import { handlePipelineStep } from "./handlePipelineStep";
import { logger } from "tttc-common/logger";

const claimsLogger = logger.child({ module: "claims-step" });

/**
 * Sends an http request to the pyserver for the claims step
 * Uses standard fetch with 40-minute timeout for large datasets
 */
export async function claimsPipelineStep(
  env: Env,
  input: ClaimsStep["data"],
  userId?: string,
  reportId?: string,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [apiPyserver.OPENAI_API_KEY_HEADER]: env.OPENAI_API_KEY,
  };

  if (reportId) {
    headers[apiPyserver.REPORT_ID_HEADER] = reportId;
  }

  if (userId) {
    headers[apiPyserver.USER_ID_HEADER] = userId;
  }

  const startTime = Date.now();
  const commentCount = input.comments?.length || 0;
  const payloadSize = JSON.stringify(input).length;

  claimsLogger.info(
    {
      reportId,
      commentCount,
      payloadSizeMB: (payloadSize / 1024 / 1024).toFixed(2),
      url: env.PYSERVER_URL,
    },
    "Starting claims extraction",
  );

  try {
    const response = await handlePipelineStep(
      apiPyserver.claimsReply,
      async () =>
        await fetch(`${env.PYSERVER_URL}/claims`, {
          method: "POST",
          body: JSON.stringify(input),
          headers,
          // 40-minute timeout for large datasets (matches OPERATION_TIMEOUT)
          signal: AbortSignal.timeout(2400000),
        }),
      env.PYSERVER_URL, // Enable health checks for retry logic
    );

    const duration = Date.now() - startTime;
    claimsLogger.info(
      {
        reportId,
        durationMs: duration,
        durationMin: (duration / 60000).toFixed(1),
        commentCount,
      },
      "Claims extraction completed successfully",
    );

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Enhanced error logging with all available details
    claimsLogger.error(
      {
        error: {
          name: error instanceof Error ? error.name : "Unknown",
          message: error instanceof Error ? error.message : String(error),
          code: (error as any).code, // Network errors have codes like ECONNREFUSED
          cause: (error as any).cause,
          stack: error instanceof Error ? error.stack : undefined,
        },
        reportId,
        durationMs: duration,
        durationMin: (duration / 60000).toFixed(1),
        commentCount,
        payloadSizeMB: (payloadSize / 1024 / 1024).toFixed(2),
        url: env.PYSERVER_URL,
        timeoutMs: 2400000,
        wasTimeout: duration >= 2400000,
      },
      "Claims extraction failed - fetch to pyserver failed",
    );

    throw error;
  }
}
