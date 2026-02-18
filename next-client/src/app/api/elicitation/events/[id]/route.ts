import { NextResponse } from "next/server";
import { logger } from "tttc-common/logger/browser";

const elicitationEventApiLogger = logger.child({
  module: "api-elicitation-event",
});

/**
 * GET /api/elicitation/events/[id]
 * Returns a single elicitation event by ID.
 * Proxies to Express server - requires authentication and event_organizer role.
 */
export async function GET(
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
      `${expressUrl}/api/elicitation/events/${encodeURIComponent(id)}`,
      {
        headers: {
          Authorization: authHeader,
        },
      },
    );

    if (!expressResponse.ok) {
      const errorBody = await expressResponse.json().catch(() => ({
        error: "Unknown error",
      }));
      elicitationEventApiLogger.error(
        { errorBody, status: expressResponse.status },
        "Express server error",
      );
      return NextResponse.json(errorBody, { status: expressResponse.status });
    }

    const result = await expressResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    elicitationEventApiLogger.error(
      { error },
      "Failed to fetch elicitation event",
    );
    return NextResponse.json(
      { error: "Failed to fetch elicitation event" },
      { status: 500 },
    );
  }
}
