import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { logger } from "tttc-common/logger/browser";

const ensureUserApiLogger = logger.child({ module: "api-ensure-user" });

export async function POST(request: Request) {
  ensureUserApiLogger.info({}, "User ensure POST request received");
  try {
    const headersList = await headers();
    const authorization = headersList.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      ensureUserApiLogger.warn(
        { req: request },
        "No valid Authorization header found",
      );
      return NextResponse.json(
        { error: "Unauthorized - missing token" },
        { status: 401 },
      );
    }

    const token = authorization.split("Bearer ")[1];

    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";
    ensureUserApiLogger.debug(
      { expressUrl },
      "Calling express server ensure-user endpoint",
    );

    const expressResponse = await fetch(`${expressUrl}/ensure-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    ensureUserApiLogger.debug(
      { status: expressResponse.status },
      "Express server response received",
    );

    if (!expressResponse.ok) {
      const errorText = await expressResponse.text();
      ensureUserApiLogger.error(
        {
          expressUrl,
          status: expressResponse.status,
          headers: Object.fromEntries(expressResponse.headers.entries()),
          body: errorText,
        },
        "Express server error",
      );
      return NextResponse.json(
        {
          error: "Failed to ensure user document",
          details: errorText,
        },
        { status: expressResponse.status },
      );
    }

    const result = await expressResponse.json();
    ensureUserApiLogger.info(
      { uid: result.uid },
      "User document ensured via express server",
    );
    return NextResponse.json({
      success: true,
      uid: result.uid,
      user: result.user,
      message: "User document ensured via express server",
    });
  } catch (error) {
    ensureUserApiLogger.error({ error }, "Failed to ensure user");
    return NextResponse.json(
      { error: "Failed to ensure user document" },
      { status: 500 },
    );
  }
}
