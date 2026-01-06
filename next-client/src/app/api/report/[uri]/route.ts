import { NextResponse } from "next/server";
import { logger } from "tttc-common/logger/browser";

const unifiedReportApiLogger = logger.child({ module: "unified-report-api" });

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

    // Call the express server's unified endpoint
    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    // Forward Authorization header if present (for ownership checks)
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const authHeader = request.headers.get("Authorization");
    if (authHeader) {
      headers.Authorization = authHeader;
    }

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

        // Pass through the status code from express
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

      // Set appropriate cache headers based on status
      // IMPORTANT: Vary by Authorization so authenticated and unauthenticated
      // requests are cached separately (isOwner differs based on auth)
      const responseHeaders: Record<string, string> = {
        Vary: "Authorization",
      };
      if (authHeader) {
        // Authenticated requests should never be cached - ownership status is user-specific
        responseHeaders["Cache-Control"] = "no-store";
      } else if (result.status === "finished") {
        responseHeaders["Cache-Control"] = "private, max-age=3600";
      } else {
        responseHeaders["Cache-Control"] =
          "no-cache, no-store, must-revalidate";
      }

      return NextResponse.json(result, { headers: responseHeaders });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        unifiedReportApiLogger.error(
          "Request timeout when fetching unified report",
        );
        return NextResponse.json({ error: "Request timeout" }, { status: 504 });
      }
      throw fetchError; // Re-throw non-timeout errors
    }
  } catch (error) {
    unifiedReportApiLogger.error({ error }, "Failed to fetch unified report");
    return NextResponse.json(
      { error: "Failed to fetch unified report" },
      { status: 500 },
    );
  }
}
