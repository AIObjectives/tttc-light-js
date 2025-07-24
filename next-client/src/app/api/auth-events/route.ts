import { NextResponse } from "next/server";
import { logger } from "tttc-common/logger";

export async function POST(request: Request) {
  logger.info("AUTH EVENTS API: Auth event request received");
  try {
    const body = await request.json();
    const { event, clientTimestamp, token } = body;

    if (!event || !["signin", "signout"].includes(event)) {
      logger.warn("AUTH EVENTS API: Invalid event type");
      return NextResponse.json(
        { error: "Invalid event type" },
        { status: 400 },
      );
    }

    logger.debug(`AUTH EVENTS API: Processing ${event} event`);

    // Call the express server's auth-events endpoint
    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";
    logger.debug(`AUTH EVENTS API: Calling ${expressUrl}/auth-events`);

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

    logger.debug(
      `AUTH EVENTS API: Express server response status: ${expressResponse.status}`,
    );

    if (!expressResponse.ok) {
      const errorData = await expressResponse.json().catch(() => ({}));
      logger.error(
        `AUTH EVENTS API: Express server error: ${expressResponse.status}`,
        errorData,
      );
      return NextResponse.json(
        { error: "Failed to log auth event" },
        { status: 500 },
      );
    }

    const result = await expressResponse.json();
    logger.info(
      "AUTH EVENTS API: Auth event logged successfully via express server",
    );
    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    logger.error("AUTH EVENTS API: Failed to log auth event:", error);
    return NextResponse.json(
      { error: "Failed to log auth event" },
      { status: 500 },
    );
  }
}
