import { NextResponse } from "next/server";
import { logger } from "tttc-common/logger";

const authEventsApiLogger = logger.child({ module: "api-auth-events" });

export async function POST(request: Request) {
  authEventsApiLogger.info("Auth event request received");
  try {
    const body = await request.json();
    const { event, clientTimestamp, token } = body;

    if (!event || !["signin", "signout"].includes(event)) {
      authEventsApiLogger.warn("Invalid event type");
      return NextResponse.json(
        { error: "Invalid event type" },
        { status: 400 },
      );
    }

    authEventsApiLogger.debug({ event }, "Processing auth event");

    // Call the express server's auth-events endpoint
    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";
    authEventsApiLogger.debug(
      { expressUrl },
      "Calling express server auth-events endpoint",
    );

    const expressBody: {
      event: string;
      clientTimestamp: string;
      firebaseAuthToken?: string;
    } = {
      event,
      clientTimestamp,
    };

    // Include Firebase token for signin events
    if (event === "signin" && token) {
      expressBody.firebaseAuthToken = token;
    }

    const expressResponse = await fetch(`${expressUrl}/auth-events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
        { status: 500 },
      );
    }

    const result = await expressResponse.json();
    authEventsApiLogger.info(
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
