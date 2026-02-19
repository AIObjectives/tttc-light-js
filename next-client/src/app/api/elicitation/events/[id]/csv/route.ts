import { logger } from "tttc-common/logger/browser";

const csvDownloadLogger = logger.child({
  module: "api-elicitation-csv",
});

/**
 * GET /api/elicitation/events/[id]/csv
 * Downloads participant response data as CSV for an elicitation event.
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
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";

    const expressResponse = await fetch(
      `${expressUrl}/api/elicitation/events/${encodeURIComponent(id)}/csv`,
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
      csvDownloadLogger.error(
        { errorBody, status: expressResponse.status },
        "Express server error",
      );
      return new Response(JSON.stringify(errorBody), {
        status: expressResponse.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const csvBody = await expressResponse.text();
    const contentDisposition =
      expressResponse.headers.get("Content-Disposition") ?? "";

    return new Response(csvBody, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": contentDisposition,
      },
    });
  } catch (error) {
    csvDownloadLogger.error({ error }, "Failed to download elicitation CSV");
    return new Response(
      JSON.stringify({ error: "Failed to download elicitation CSV" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
