import * as apiPyserver from "tttc-common/apiPyserver";
import { ClaimsStep } from "./types";
import { Env } from "../types/context";
import { handlePipelineStep } from "./handlePipelineStep";
import { logger } from "tttc-common/logger";

const claimsLogger = logger.child({ module: "claims-step" });

/**
 * Sends an http request to the pyserver for the claims step
 * Uses standard fetch with 1-hour timeout to match Cloud Run service limit
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
          // 1-hour timeout to match Cloud Run service limit
          signal: AbortSignal.timeout(3600000),
        }),
      env.PYSERVER_URL, // Enable health checks for retry logic
    );

    const duration = Date.now() - startTime;

    // Log detailed response information
    if (response.tag === "success") {
      const responseString = JSON.stringify(response.value);
      const responseSize = responseString.length;
      const claimsCount = Array.isArray(response.value.data)
        ? response.value.data.length
        : Object.keys(response.value.data || {}).length;

      claimsLogger.info(
        {
          reportId,
          durationMs: duration,
          durationMin: (duration / 60000).toFixed(1),
          commentCount,
          claimsReturned: claimsCount,
          responseSizeMB: (responseSize / 1024 / 1024).toFixed(2),
          responseSizeBytes: responseSize,
          hasData: !!response.value.data,
          dataKeys: response.value.data
            ? Object.keys(response.value.data).slice(0, 5)
            : [],
        },
        "Claims extraction completed successfully",
      );
    } else {
      claimsLogger.warn(
        {
          reportId,
          durationMs: duration,
          responseTag: response.tag,
        },
        "Claims extraction returned with failure tag",
      );
    }

    claimsLogger.debug({ reportId }, "Returning from claimsPipelineStep");
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
        timeoutMs: 3600000,
        wasTimeout: duration >= 3600000,
      },
      "Claims extraction failed - fetch to pyserver failed",
    );

    throw error;
  }
}
