import { NextResponse } from "next/server";
import { logger } from "tttc-common/logger/browser";

const visibilityApiLogger = logger.child({ module: "api-visibility" });

/**
 * PATCH /api/report/[uri]/visibility
 * Updates the visibility (isPublic) of a report.
 * Proxies to Express server - requires authentication.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ uri: string }> },
) {
  try {
    const { uri: reportId } = await params;

    if (!reportId) {
      return NextResponse.json(
        { error: "Missing report ID parameter" },
        { status: 400 },
      );
    }

    // Get Authorization header - required for this endpoint
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Get request body
    const body = await request.json();

    visibilityApiLogger.debug(
      { reportId, isPublic: body.isPublic },
      "Updating report visibility",
    );

    // Call the express server's visibility endpoint
    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";

    const expressResponse = await fetch(
      `${expressUrl}/report/${encodeURIComponent(reportId)}/visibility`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify(body),
      },
    );

    visibilityApiLogger.debug(
      { status: expressResponse.status },
      "Express server response status",
    );

    if (!expressResponse.ok) {
      const errorData = await expressResponse
        .text()
        .catch(() => "Unknown error");
      visibilityApiLogger.error(
        { errorData, status: expressResponse.status },
        "Express server error",
      );

      return NextResponse.json(
        { error: errorData },
        { status: expressResponse.status },
      );
    }

    const result = await expressResponse.json();
    visibilityApiLogger.debug({ result }, "Visibility update successful");

    return NextResponse.json(result);
  } catch (error) {
    visibilityApiLogger.error({ error }, "Failed to update report visibility");
    return NextResponse.json(
      { error: "Failed to update report visibility" },
      { status: 500 },
    );
  }
}
