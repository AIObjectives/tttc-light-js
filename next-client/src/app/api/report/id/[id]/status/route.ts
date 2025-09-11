import { NextResponse } from "next/server";
import { logger } from "tttc-common/logger/browser";
import { FIRESTORE_ID_REGEX } from "tttc-common/utils";

const reportStatusLogger = logger.child({ module: "report-status-api" });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Validate report ID format
    if (!id || !FIRESTORE_ID_REGEX.test(id)) {
      return NextResponse.json(
        { error: "Invalid report ID format" },
        { status: 400 },
      );
    }

    reportStatusLogger.debug({ id }, `Fetching status`);

    // Call the express server's report ID status endpoint
    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";

    const expressResponse = await fetch(
      `${expressUrl}/report/id/${id}/status`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    reportStatusLogger.debug(
      { status: expressResponse.status },
      `Express server response status`,
    );

    if (!expressResponse.ok) {
      const errorData = await expressResponse.text().catch(() => null);
      return NextResponse.json(
        { error: errorData || "Failed to fetch report status" },
        { status: expressResponse.status },
      );
    }

    const result = await expressResponse.json();
    reportStatusLogger.debug({}, "Report status fetched successfully");

    return NextResponse.json(result);
  } catch (error) {
    reportStatusLogger.error({ error }, "Error in report status API");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
