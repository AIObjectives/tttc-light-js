import { NextResponse } from "next/server";
import { logger } from "tttc-common/logger/browser";

const generateReportLogger = logger.child({
  module: "api-elicitation-generate-report",
});

/**
 * POST /api/elicitation/events/[id]/generate-report
 * Generates a report from participant data for an elicitation event.
 * Proxies to Express server - requires authentication and event_organizer role.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";

    const expressResponse = await fetch(
      `${expressUrl}/api/elicitation/events/${encodeURIComponent(id)}/generate-report`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
      },
    );

    if (!expressResponse.ok) {
      const errorBody = await expressResponse.json().catch(() => ({
        error: "Unknown error",
      }));
      generateReportLogger.error(
        { errorBody, status: expressResponse.status },
        "Express server error",
      );
      return NextResponse.json(errorBody, { status: expressResponse.status });
    }

    const result = await expressResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    generateReportLogger.error({ error }, "Failed to generate report");
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}
