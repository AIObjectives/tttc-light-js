import { NextResponse } from "next/server";
import { logger } from "tttc-common/logger/browser";

const elicitationApiLogger = logger.child({ module: "api-elicitation-events" });

/**
 * GET /api/elicitation/events
 * Returns elicitation events owned by the authenticated user.
 * Proxies to Express server - requires authentication and event_organizer role.
 */
export async function GET(request: Request) {
  try {
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
      `${expressUrl}/api/elicitation/events`,
      {
        headers: {
          Authorization: authHeader,
        },
      },
    );

    if (!expressResponse.ok) {
      const errorData = await expressResponse
        .text()
        .catch(() => "Unknown error");
      elicitationApiLogger.error(
        { errorData, status: expressResponse.status },
        "Express server error",
      );
      return NextResponse.json(
        { error: errorData },
        { status: expressResponse.status },
      );
    }

    const result = await expressResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    elicitationApiLogger.error({ error }, "Failed to fetch elicitation events");
    return NextResponse.json(
      { error: "Failed to fetch elicitation events" },
      { status: 500 },
    );
  }
}
