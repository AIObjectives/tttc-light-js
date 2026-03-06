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
      const errorBody = await expressResponse.json().catch(() => ({
        error: "Unknown error",
      }));
      elicitationApiLogger.error(
        { errorBody, status: expressResponse.status },
        "Express server error",
      );
      return NextResponse.json(errorBody, { status: expressResponse.status });
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

/**
 * POST /api/elicitation/events
 * Creates a new elicitation event (study).
 * Proxies to Express server - requires authentication and event_organizer role.
 */
export async function POST(request: Request) {
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

    const body = await request.json();

    const expressResponse = await fetch(
      `${expressUrl}/api/elicitation/events`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!expressResponse.ok) {
      const errorBody = await expressResponse.json().catch(() => ({
        error: "Unknown error",
      }));
      elicitationApiLogger.error(
        { errorBody, status: expressResponse.status },
        "Express server error",
      );
      return NextResponse.json(errorBody, { status: expressResponse.status });
    }

    const result = await expressResponse.json();
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    elicitationApiLogger.error({ error }, "Failed to create elicitation event");
    return NextResponse.json(
      { error: "Failed to create elicitation event" },
      { status: 500 },
    );
  }
}
