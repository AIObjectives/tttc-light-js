import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { logger } from "tttc-common/logger/browser";

const authEventsApiLogger = logger.child({ module: "api-auth-events" });

export async function POST(request: Request) {
  authEventsApiLogger.info({ req: request }, "Auth event request received");
  try {
    const body = await request.json();
    const { event, clientTimestamp } = body;

    if (!event || !["signin", "signout"].includes(event)) {
      authEventsApiLogger.warn({ event }, "Invalid event type");
      return NextResponse.json(
        { error: "Invalid event type" },
        { status: 400 },
      );
    }

    // Get Authorization header from client request
    const headersList = await headers();
    const authorization = headersList.get("Authorization");

    authEventsApiLogger.debug({ event }, "Processing auth event");

    // Call the express server's auth-events endpoint
    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";
    authEventsApiLogger.debug(
      { expressUrl },
      "Calling express server auth-events endpoint",
    );

    const expressBody = {
      event,
      clientTimestamp,
    };

    // Forward Authorization header if present (required for signin)
    const expressHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authorization) {
      expressHeaders.Authorization = authorization;
    }

    const expressResponse = await fetch(`${expressUrl}/auth-events`, {
      method: "POST",
      headers: expressHeaders,
      body: JSON.stringify(expressBody),
    });

    authEventsApiLogger.debug(
      { status: expressResponse.status },
      "Express server response received",
    );

    if (!expressResponse.ok) {
      const errorData = await expressResponse.json().catch(() => ({}));
      authEventsApiLogger.error(
        {
          status: expressResponse.status,
          errorData,
        },
        "Express server error",
      );
      return NextResponse.json(
        { error: "Failed to log auth event" },
        { status: expressResponse.status },
      );
    }

    const result = await expressResponse.json();
    authEventsApiLogger.info(
      {},
      "Auth event logged successfully via express server",
    );
    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    authEventsApiLogger.error({ error }, "Failed to log auth event");
    return NextResponse.json(
      { error: "Failed to log auth event" },
      { status: 500 },
    );
  }
}
