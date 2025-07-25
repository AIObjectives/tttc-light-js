import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { logger } from "tttc-common/logger";

export async function POST(request: Request) {
  logger.info("ENSURE USER API: User ensure POST request received");
  try {
    const headersList = await headers();
    const authorization = headersList.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      logger.warn("ENSURE USER API: No valid Authorization header found");
      return NextResponse.json(
        { error: "Unauthorized - missing token" },
        { status: 401 },
      );
    }

    const token = authorization.split("Bearer ")[1];
    logger.debug(
      "ENSURE USER API: Got token, calling express server ensure-user endpoint",
    );

    // Call the express server's dedicated ensure-user endpoint
    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";
    logger.debug(`ENSURE USER API: Calling ${expressUrl}/ensure-user`);

    const expressResponse = await fetch(`${expressUrl}/ensure-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firebaseAuthToken: token,
      }),
    });

    logger.debug(
      `ENSURE USER API: Express server response status: ${expressResponse.status}`,
    );

    if (!expressResponse.ok) {
      const errorText = await expressResponse.text();
      logger.error(
        `ENSURE USER API: Express server error: ${expressResponse.status} - ${errorText}`,
      );
      return NextResponse.json(
        { error: "Failed to ensure user document via express server" },
        { status: 500 },
      );
    }

    const result = await expressResponse.json();
    logger.info(
      "ENSURE USER API: User document ensured via express server for UID:",
      result.uid,
    );
    return NextResponse.json({
      success: true,
      uid: result.uid,
      message: "User document ensured via express server",
    });
  } catch (error) {
    logger.error("ENSURE USER API: Failed to ensure user:", error);
    return NextResponse.json(
      { error: "Failed to ensure user document" },
      { status: 500 },
    );
  }
}
