import { NextResponse } from "next/server";
import { logger } from "tttc-common/logger/browser";

const unifiedReportApiLogger = logger.child({ module: "unified-report-api" });

/**
 * Build request headers, forwarding Authorization if present.
 */
function buildRequestHeaders(
  authHeader: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authHeader) {
    headers.Authorization = authHeader;
  }
  return headers;
}

/**
 * Fetch report data from GCS if requested and available.
 * Logs warning on failure but doesn't throw.
 */
async function fetchReportDataIfRequested(
  result: { status?: string; dataUrl?: string; reportData?: unknown },
  shouldInclude: boolean,
): Promise<void> {
  if (!shouldInclude || result.status !== "finished" || !result.dataUrl) {
    return;
  }

  try {
    const dataResponse = await fetch(result.dataUrl);
    if (dataResponse.ok) {
      result.reportData = await dataResponse.json();
    }
  } catch (dataFetchError) {
    unifiedReportApiLogger.warn(
      { error: dataFetchError },
      "Failed to fetch report data from storage",
    );
  }
}

/**
 * Determine cache headers based on auth status and report status.
 */
function getCacheHeaders(
  authHeader: string | null,
  reportStatus: string | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {
    Vary: "Authorization",
  };

  if (authHeader) {
    headers["Cache-Control"] = "no-store";
  } else if (reportStatus === "finished") {
    headers["Cache-Control"] = "private, max-age=3600";
  } else {
    headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
  }

  return headers;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uri: string }> },
) {
  try {
    const { uri: identifier } = await params;

    if (!identifier) {
      return NextResponse.json(
        { error: "Missing report identifier parameter" },
        { status: 400 },
      );
    }

    unifiedReportApiLogger.debug({ identifier }, "Fetching unified report");

    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";
    const authHeader = request.headers.get("Authorization");
    const headers = buildRequestHeaders(authHeader);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const expressResponse = await fetch(
        `${expressUrl}/report/${encodeURIComponent(identifier)}`,
        {
          method: "GET",
          headers,
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      unifiedReportApiLogger.debug(
        { status: expressResponse.status },
        "Express server response status",
      );

      if (!expressResponse.ok) {
        const errorData = await expressResponse
          .text()
          .catch(() => "Unknown error");
        unifiedReportApiLogger.error(
          { errorData },
          `UNIFIED API: Express server error: ${expressResponse.status}`,
        );
        return NextResponse.json(
          { error: errorData },
          { status: expressResponse.status },
        );
      }

      const result = await expressResponse.json();
      unifiedReportApiLogger.debug(
        { result },
        "Unified report fetched successfully",
      );

      const includeData =
        request.headers.get("X-Include-Report-Data") === "true";
      await fetchReportDataIfRequested(result, includeData);

      const responseHeaders = getCacheHeaders(authHeader, result.status);
      return NextResponse.json(result, { headers: responseHeaders });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        unifiedReportApiLogger.error(
          "Request timeout when fetching unified report",
        );
        return NextResponse.json({ error: "Request timeout" }, { status: 504 });
      }
      throw fetchError;
    }
  } catch (error) {
    unifiedReportApiLogger.error({ error }, "Failed to fetch unified report");
    return NextResponse.json(
      { error: "Failed to fetch unified report" },
      { status: 500 },
    );
  }
}
