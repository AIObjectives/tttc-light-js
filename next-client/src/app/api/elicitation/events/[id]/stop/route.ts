import { NextResponse } from "next/server";
import { logger } from "tttc-common/logger/browser";

const stopLogger = logger.child({ module: "api-elicitation-stop" });

/**
 * PATCH /api/elicitation/events/[id]/stop
 * Stops an elicitation event (sets event_initialized to false).
 * Proxies to Express server - requires authentication and event_organizer role.
 */
export async function PATCH(
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
      `${expressUrl}/api/elicitation/events/${encodeURIComponent(id)}/stop`,
      {
        method: "PATCH",
        headers: { Authorization: authHeader },
      },
    );

    if (!expressResponse.ok) {
      const errorBody = await expressResponse.json().catch(() => ({
        error: "Unknown error",
      }));
      stopLogger.error(
        { errorBody, status: expressResponse.status },
        "Express server error",
      );
      return NextResponse.json(errorBody, { status: expressResponse.status });
    }

    const result = await expressResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    stopLogger.error({ error }, "Failed to stop study");
    return NextResponse.json({ error: "Failed to stop study" }, { status: 500 });
  }
}
