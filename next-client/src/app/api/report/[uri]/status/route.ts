import { NextResponse } from "next/server";
import { logger } from "tttc-common/logger/browser";
const reportStatusApiLogger = logger.child({ module: "report-status-api" });

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

    reportStatusApiLogger.debug({ uri }, `Checking status for URI`);

    // Call the express server's status endpoint
    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";

    const expressResponse = await fetch(
      `${expressUrl}/report/${encodeURIComponent(uri)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    reportStatusApiLogger.debug(
      { status: expressResponse.status },
      `Express server response status`,
    );

    if (!expressResponse.ok) {
      const errorData = await expressResponse
        .text()
        .catch(() => "Unknown error");
      reportStatusApiLogger.error(
        { errorData },
        `STATUS API: Express server error: ${expressResponse.status}`,
      );

      // Pass through the status code from express
      return NextResponse.json(
        { error: errorData },
        { status: expressResponse.status },
      );
    }

    const result = await expressResponse.json();
    reportStatusApiLogger.debug({ result }, "Status fetched successfully");

    return NextResponse.json(result);
  } catch (error) {
    reportStatusApiLogger.error({ error }, "Failed to fetch report status");
    return NextResponse.json(
      { error: "Failed to fetch report status" },
      { status: 500 },
    );
  }
}
