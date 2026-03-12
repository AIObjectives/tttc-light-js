import { NextResponse } from "next/server";
import { logger } from "tttc-common/logger/browser";

const launchLogger = logger.child({ module: "api-elicitation-launch" });

/**
 * PATCH /api/elicitation/events/[id]/launch
 * Launches an elicitation event (sets event_initialized to true).
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
      `${expressUrl}/api/elicitation/events/${encodeURIComponent(id)}/launch`,
      {
        method: "PATCH",
        headers: { Authorization: authHeader },
      },
    );

    if (!expressResponse.ok) {
      const errorBody = await expressResponse.json().catch(() => ({
        error: "Unknown error",
      }));
      launchLogger.error(
        { errorBody, status: expressResponse.status },
        "Express server error",
      );
      return NextResponse.json(errorBody, { status: expressResponse.status });
    }

    const result = await expressResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    launchLogger.error({ error }, "Failed to launch study");
    return NextResponse.json(
      { error: "Failed to launch study" },
      { status: 500 },
    );
  }
}
