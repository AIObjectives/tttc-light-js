import { NextResponse } from "next/server";
import { logger } from "tttc-common/logger/browser";

const migrateApiLogger = logger.child({ module: "api-migrate" });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uri: string }> },
) {
  try {
    const { uri } = await params;

    if (!uri) {
      return NextResponse.json(
        { error: "Missing report URI parameter" },
        { status: 400 },
      );
    }

    migrateApiLogger.debug({ uri }, `Attempting migration for URI`);

    // Call the express server's migration endpoint
    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";

    const expressResponse = await fetch(
      `${expressUrl}/report/${encodeURIComponent(uri)}/migrate`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    migrateApiLogger.debug(
      { status: expressResponse.status },
      `Express server response status`,
    );

    if (!expressResponse.ok) {
      const errorData = await expressResponse
        .text()
        .catch(() => "Unknown error");
      migrateApiLogger.error(
        {
          errorData,
          status: expressResponse.status,
        },
        `Express server error`,
      );

      // Pass through the status code from express
      return NextResponse.json(
        { error: errorData },
        { status: expressResponse.status },
      );
    }

    const result = await expressResponse.json();
    migrateApiLogger.debug({ result }, "Migration successful");

    return NextResponse.json(result);
  } catch (error) {
    migrateApiLogger.error({ error }, "Failed to migrate URL");
    return NextResponse.json(
      { error: "Failed to migrate URL" },
      { status: 500 },
    );
  }
}
