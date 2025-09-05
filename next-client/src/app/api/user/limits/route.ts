import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { logger } from "tttc-common/logger/browser";

const userLimitsApiLogger = logger.child({ module: "api-user-limits" });

export async function GET(request: Request) {
  userLimitsApiLogger.info({}, "User limits GET request received");
  try {
    const headersList = await headers();
    const authorization = headersList.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      userLimitsApiLogger.warn(
        { req: request },
        "No valid Authorization header found",
      );
      return NextResponse.json(
        { error: "Unauthorized - missing token" },
        { status: 401 },
      );
    }

    const token = authorization.split("Bearer ")[1];
    userLimitsApiLogger.debug(
      {},
      "Got token, calling express server user limits endpoint",
    );

    // Call the express server's user limits endpoint
    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";
    userLimitsApiLogger.debug(
      { expressUrl },
      "Calling express server user limits endpoint",
    );

    const expressResponse = await fetch(`${expressUrl}/api/user/limits`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    userLimitsApiLogger.debug(
      { status: expressResponse.status },
      "Express server response received",
    );

    if (!expressResponse.ok) {
      const errorText = await expressResponse.text();
      userLimitsApiLogger.error(
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
          error: "Failed to get user limits from express server",
          details: errorText,
        },
        { status: expressResponse.status },
      );
    }

    const result = await expressResponse.json();
    userLimitsApiLogger.info(
      { capabilities: result },
      "User limits retrieved from express server",
    );
    return NextResponse.json(result);
  } catch (error) {
    userLimitsApiLogger.error({ error }, "Failed to get user limits");
    return NextResponse.json(
      { error: "Failed to get user limits" },
      { status: 500 },
    );
  }
}
