import { NextResponse } from "next/server";
import { logger } from "tttc-common/logger/browser";

export async function GET(
  request: Request,
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

    logger.debug(`MIGRATION API: Attempting migration for URI: ${uri}`);

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

    logger.debug(
      `MIGRATION API: Express server response status: ${expressResponse.status}`,
    );

    if (!expressResponse.ok) {
      const errorData = await expressResponse
        .text()
        .catch(() => "Unknown error");
      logger.error(
        { errorData },
        `MIGRATION API: Express server error: ${expressResponse.status}`,
      );

      // Pass through the status code from express
      return NextResponse.json(
        { error: errorData },
        { status: expressResponse.status },
      );
    }

    const result = await expressResponse.json();
    logger.debug("MIGRATION API: Migration successful", result);

    return NextResponse.json(result);
  } catch (error) {
    logger.error({ error }, "MIGRATION API: Failed to migrate URL");
    return NextResponse.json(
      { error: "Failed to migrate URL" },
      { status: 500 },
    );
  }
}
