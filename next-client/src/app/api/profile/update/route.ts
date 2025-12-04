import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { logger } from "tttc-common/logger/browser";

const profileUpdateApiLogger = logger.child({ module: "api-profile-update" });

export async function POST(request: Request) {
  profileUpdateApiLogger.info({}, "Profile update POST request received");
  try {
    const headersList = await headers();
    const authorization = headersList.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      profileUpdateApiLogger.warn({}, "No valid Authorization header found");
      return NextResponse.json(
        { error: "Unauthorized - missing token" },
        { status: 401 },
      );
    }

    const token = authorization.split("Bearer ")[1];
    const body = await request.json();

    profileUpdateApiLogger.debug(
      {},
      "Got token, calling express server profile update endpoint",
    );

    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";
    profileUpdateApiLogger.debug(
      { expressUrl },
      "Calling express server profile update endpoint",
    );

    const expressResponse = await fetch(`${expressUrl}/api/profile/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    profileUpdateApiLogger.debug(
      { status: expressResponse.status },
      "Express server response received",
    );

    if (!expressResponse.ok) {
      const errorText = await expressResponse.text();
      profileUpdateApiLogger.error(
        {
          expressUrl,
          status: expressResponse.status,
          body: errorText,
        },
        "Express server error",
      );
      return NextResponse.json(
        {
          error: "Failed to update profile",
          details: errorText,
        },
        { status: expressResponse.status },
      );
    }

    const result = await expressResponse.json();
    profileUpdateApiLogger.info({}, "Profile updated successfully");
    return NextResponse.json(result);
  } catch (error) {
    profileUpdateApiLogger.error({ error }, "Failed to update profile");
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }
}
