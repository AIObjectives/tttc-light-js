import { NextResponse } from "next/server";
import { logger } from "tttc-common/logger/browser";
import {
  initializeFeatureFlags,
  isFeatureEnabled,
} from "@/lib/feature-flags/featureFlags.server";

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
    initializeFeatureFlags();
    const enabled = await isFeatureEnabled("elicitation_enabled");
    if (!enabled) {
      return NextResponse.json({ error: "Feature not available" }, { status: 403 });
    }

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
